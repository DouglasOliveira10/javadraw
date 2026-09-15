package br.com.douglasoliveira10.javadraw.graph;

import br.com.douglasoliveira10.javadraw.ExternalCalls;
import br.com.douglasoliveira10.javadraw.analysis.EntryPoints;
import br.com.douglasoliveira10.javadraw.analysis.Stereotypes;
import br.com.douglasoliveira10.javadraw.asm.Annotations;
import br.com.douglasoliveira10.javadraw.asm.MethodBodies;
import br.com.douglasoliveira10.javadraw.asm.MethodBodies.Body;
import br.com.douglasoliveira10.javadraw.asm.MethodBodies.RawCall;
import br.com.douglasoliveira10.javadraw.asm.TypeNames;
import br.com.douglasoliveira10.javadraw.asm.TypeSignatures;
import br.com.douglasoliveira10.javadraw.model.CallEdge;
import br.com.douglasoliveira10.javadraw.model.CallKind;
import br.com.douglasoliveira10.javadraw.model.FieldInfo;
import br.com.douglasoliveira10.javadraw.model.Meta;
import br.com.douglasoliveira10.javadraw.model.MethodInfo;
import br.com.douglasoliveira10.javadraw.model.ProjectModel;
import br.com.douglasoliveira10.javadraw.model.Relation;
import br.com.douglasoliveira10.javadraw.model.RelationKind;
import br.com.douglasoliveira10.javadraw.model.TypeInfo;
import br.com.douglasoliveira10.javadraw.model.TypeKind;
import br.com.douglasoliveira10.javadraw.model.Visibility;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.Type;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.FieldNode;
import org.objectweb.asm.tree.InnerClassNode;
import org.objectweb.asm.tree.LocalVariableNode;
import org.objectweb.asm.tree.MethodNode;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Turns parsed class nodes into a {@link ProjectModel}: types, structural relations and a call graph
 * resolved with class hierarchy analysis.
 */
public final class ModelBuilder {

    private static final Set<String> IMPLICIT_SUPERTYPES = Set.of("java/lang/Object", "java/lang/Enum", "java/lang/Record");
    private static final Set<String> MANY_CONTAINERS = Set.of(
            "java/lang/Iterable", "java/util/Map", "java/util/stream/BaseStream", "java/util/Iterator");
    private static final Set<String> OPTIONAL_CONTAINERS = Set.of("java/util/Optional");

    private final Map<String, ClassNode> classes;
    private final TypeHierarchy hierarchy;
    private final TypeFilter filter;
    private final ExternalCalls externalCalls;

    private final Map<ClassNode, Map<MethodNode, Body>> bodies = new HashMap<>();
    /** Owner internal name → name+descriptor → method; declared methods followed by inherited stubs. */
    private final Map<String, LinkedHashMap<String, MethodInfo>> methods = new LinkedHashMap<>();
    private final Map<String, LinkedHashMap<String, MethodInfo>> externalMethods = new LinkedHashMap<>();
    private final Set<String> externalTypes = new LinkedHashSet<>();
    private final Map<String, CallEdge> calls = new LinkedHashMap<>();
    private final List<Relation> relations = new ArrayList<>();
    private final Set<String> relationKeys = new HashSet<>();

    /**
     * @param classes project classes keyed by internal name; classes outside the filter includes are
     *                expected to be absent so they become external
     */
    public ModelBuilder(Map<String, ClassNode> classes, TypeHierarchy hierarchy, TypeFilter filter,
                        ExternalCalls externalCalls) {
        this.classes = classes;
        this.hierarchy = hierarchy;
        this.filter = filter;
        this.externalCalls = externalCalls;
    }

    public ProjectModel build(Meta meta) {
        for (ClassNode node : classes.values()) {
            methods.put(node.name, declaredMethods(node));
        }
        for (ClassNode node : classes.values()) {
            collectCalls(node);
        }
        collectOverrides();
        List<TypeInfo> types = new ArrayList<>();
        Map<String, TypeInfo> projectTypes = new LinkedHashMap<>();
        for (ClassNode node : classes.values()) {
            collectRelations(node);
        }
        for (ClassNode node : classes.values()) {
            projectTypes.put(TypeNames.binaryName(node.name), projectType(node));
        }
        Stereotypes stereotypes = new Stereotypes(hierarchy, id -> {
            TypeInfo t = projectTypes.get(id);
            return t == null ? null : t.annotations();
        });
        for (TypeInfo type : projectTypes.values()) {
            types.add(withRoles(type, stereotypes));
        }
        for (String external : externalTypes) {
            types.add(externalType(external));
        }
        return new ProjectModel(meta, types, relations, new ArrayList<>(calls.values()));
    }

    // ---------------------------------------------------------------- methods

    private LinkedHashMap<String, MethodInfo> declaredMethods(ClassNode node) {
        LinkedHashMap<String, MethodInfo> result = new LinkedHashMap<>();
        Map<MethodNode, Body> scanned = new HashMap<>();
        for (MethodNode method : node.methods) {
            scanned.put(method, MethodBodies.scan(node, method));
            if (isHidden(method)) continue;
            result.put(method.name + method.desc, methodInfo(node, method, scanned.get(method)));
        }
        bodies.put(node, scanned);
        return result;
    }

    private static boolean isHidden(MethodNode method) {
        return (method.access & (Opcodes.ACC_SYNTHETIC | Opcodes.ACC_BRIDGE)) != 0;
    }

    private MethodInfo methodInfo(ClassNode owner, MethodNode method, Body body) {
        TypeSignatures.RenderedMethod rendered = TypeSignatures.method(method.desc, method.signature);
        List<String> names = parameterNames(method, rendered.parameters().size());
        List<String> parameters = new ArrayList<>();
        for (int i = 0; i < rendered.parameters().size(); i++) {
            String name = names.get(i);
            parameters.add(name == null ? rendered.parameters().get(i) : rendered.parameters().get(i) + " " + name);
        }
        boolean constructor = method.name.equals("<init>");
        String displayName = constructor ? TypeNames.simpleName(owner.name)
                : method.name.equals("<clinit>") ? "static {}" : method.name;
        String signature = method.name.equals("<clinit>") ? displayName
                : displayName + "(" + String.join(", ", parameters) + ")"
                  + (constructor ? "" : ": " + rendered.returnType());
        return new MethodInfo(
                TypeNames.methodId(owner.name, method.name, method.desc),
                displayName, method.desc, signature, Visibility.of(method.access),
                (method.access & Opcodes.ACC_STATIC) != 0,
                (method.access & Opcodes.ACC_ABSTRACT) != 0,
                constructor, MethodBodies.isAccessor(owner, method), isGenerated(owner, method, body), false, false, null,
                Annotations.read(method.visibleAnnotations, method.invisibleAnnotations),
                MethodBodies.firstLine(method));
    }

    /** Parameter names from the MethodParameters attribute or the local variable table, aligned to the last parameters. */
    private static List<String> parameterNames(MethodNode method, int displayed) {
        Type[] arguments = Type.getArgumentTypes(method.desc);
        String[] names = new String[arguments.length];
        if (method.parameters != null && method.parameters.size() == arguments.length) {
            for (int i = 0; i < arguments.length; i++) names[i] = method.parameters.get(i).name;
        } else if (method.localVariables != null) {
            int slot = (method.access & Opcodes.ACC_STATIC) != 0 ? 0 : 1;
            for (int i = 0; i < arguments.length; i++) {
                int index = slot;
                names[i] = method.localVariables.stream().filter(v -> v.index == index)
                        .map((LocalVariableNode v) -> v.name).findFirst().orElse(null);
                slot += arguments[i].getSize();
            }
        }
        List<String> result = new ArrayList<>(displayed);
        for (int i = arguments.length - displayed; i < arguments.length; i++) {
            result.add(i >= 0 ? names[i] : null);
        }
        return result;
    }

    private static MethodInfo stub(String owner, String name, String descriptor, boolean inherited) {
        TypeSignatures.RenderedMethod rendered = TypeSignatures.method(descriptor, null);
        boolean constructor = name.equals("<init>");
        String displayName = constructor ? TypeNames.simpleName(owner) : name;
        String signature = displayName + "(" + String.join(", ", rendered.parameters()) + ")"
                           + (constructor ? "" : ": " + rendered.returnType());
        return new MethodInfo(TypeNames.methodId(owner, name, descriptor), displayName, descriptor, signature,
                Visibility.PUBLIC, false, false, constructor, false, false, inherited, false, null, List.of(), 0);
    }

    private static boolean isGenerated(ClassNode owner, MethodNode method, Body body) {
        if (body.recordObjectMethod()) return true;
        if (!"java/lang/Enum".equals(owner.superName) || (method.access & Opcodes.ACC_STATIC) == 0) return false;
        return method.name.equals("values") && method.desc.equals("()[L" + owner.name + ";")
               || method.name.equals("valueOf") && method.desc.equals("(Ljava/lang/String;)L" + owner.name + ";");
    }

    // ---------------------------------------------------------------- calls

    private void collectCalls(ClassNode node) {
        Map<MethodNode, Body> scanned = bodies.get(node);
        for (MethodNode method : node.methods) {
            if (isHidden(method)) continue;
            String source = TypeNames.methodId(node.name, method.name, method.desc);
            for (RawCall call : callsIncludingLambdas(node, method, scanned)) {
                resolveCall(call).ifPresent(target -> addCall(new CallEdge(source, target, kindOf(call), call.line(), false)));
            }
        }
    }

    /** Calls made by the method itself and by every lambda body it creates (lambdas are folded into their creator). */
    private static List<RawCall> callsIncludingLambdas(ClassNode node, MethodNode method, Map<MethodNode, Body> scanned) {
        List<RawCall> result = new ArrayList<>();
        Deque<MethodNode> pending = new ArrayDeque<>(List.of(method));
        Set<MethodNode> visited = new HashSet<>();
        while (!pending.isEmpty()) {
            MethodNode current = pending.poll();
            if (!visited.add(current)) continue;
            Body body = scanned.get(current);
            result.addAll(body.calls());
            for (String lambda : body.lambdas()) {
                node.methods.stream().filter(m -> lambda.equals(m.name + m.desc)).findFirst().ifPresent(pending::add);
            }
        }
        return result;
    }

    private Optional<String> resolveCall(RawCall call) {
        String owner = call.owner();
        if (owner.startsWith("[") || filter.isExcluded(TypeNames.binaryName(owner))) return Optional.empty();
        String member = call.name() + call.descriptor();

        if (classes.containsKey(owner)) {
            List<String> candidates = call.opcode() == Opcodes.INVOKESPECIAL && call.name().equals("<init>")
                    ? List.of(owner) : hierarchy.linearization(owner);
            for (String candidate : candidates) {
                LinkedHashMap<String, MethodInfo> declared = methods.get(candidate);
                if (declared != null && declared.containsKey(member)) {
                    return Optional.of(declared.get(member).id());
                }
            }
            MethodInfo inherited = methods.get(owner)
                    .computeIfAbsent(member, k -> stub(owner, call.name(), call.descriptor(), true));
            return Optional.of(inherited.id());
        }

        boolean platform = hierarchy.isPlatform(owner);
        boolean keep = switch (externalCalls) {
            case NONE -> false;
            case LIBRARIES -> !platform;
            case ALL -> true;
        };
        if (!keep) return Optional.empty();
        externalTypes.add(owner);
        return Optional.of(externalMethods.computeIfAbsent(owner, k -> new LinkedHashMap<>())
                .computeIfAbsent(member, k -> stub(owner, call.name(), call.descriptor(), false)).id());
    }

    private static CallKind kindOf(RawCall call) {
        if (call.methodReference()) return CallKind.DYNAMIC;
        return switch (call.opcode()) {
            case Opcodes.INVOKESTATIC -> CallKind.STATIC;
            case Opcodes.INVOKEINTERFACE -> CallKind.INTERFACE;
            case Opcodes.INVOKESPECIAL -> CallKind.SPECIAL;
            default -> CallKind.VIRTUAL;
        };
    }

    /** Keeps one edge per caller/callee pair, at the first line where the call happens. */
    private void addCall(CallEdge edge) {
        calls.merge(edge.source() + "->" + edge.target(), edge, (existing, added) ->
                existing.line() == 0 || (added.line() != 0 && added.line() < existing.line()) ? added : existing);
    }

    /**
     * For every overridable project method, adds an edge from each nearest overridden declaration
     * (project method, inherited stub, or called external method) to the overriding method.
     */
    private void collectOverrides() {
        for (ClassNode node : classes.values()) {
            for (MethodInfo method : List.copyOf(methods.get(node.name).values())) {
                if (method.isStatic() || method.isConstructor() || method.visibility() == Visibility.PRIVATE
                        || method.name().equals("static {}") || method.inherited()) {
                    continue;
                }
                String member = method.name() + method.descriptor();
                Deque<String> pending = new ArrayDeque<>(hierarchy.directSupertypes(node.name));
                Set<String> visited = new HashSet<>();
                while (!pending.isEmpty()) {
                    String supertype = pending.poll();
                    if (!visited.add(supertype)) continue;
                    MethodInfo overridden = Optional.ofNullable(methods.get(supertype))
                            .or(() -> Optional.ofNullable(externalMethods.get(supertype)))
                            .map(m -> m.get(member)).orElse(null);
                    if (overridden != null) {
                        addCall(new CallEdge(overridden.id(), method.id(), CallKind.OVERRIDE, 0, true));
                    } else {
                        pending.addAll(hierarchy.directSupertypes(supertype));
                    }
                }
            }
        }
    }

    // ---------------------------------------------------------------- relations

    private void collectRelations(ClassNode node) {
        String source = TypeNames.binaryName(node.name);
        Set<String> related = new HashSet<>();
        boolean isInterface = (node.access & Opcodes.ACC_INTERFACE) != 0;

        if (node.superName != null && !IMPLICIT_SUPERTYPES.contains(node.superName)) {
            addStructural(source, node.superName, RelationKind.EXTENDS, null, null, related);
        }
        for (String itf : node.interfaces) {
            if (isInterface && itf.equals("java/lang/annotation/Annotation")) continue;
            addStructural(source, itf, isInterface ? RelationKind.EXTENDS : RelationKind.IMPLEMENTS, null, null, related);
        }

        Set<String> used = new LinkedHashSet<>();
        for (FieldNode field : node.fields) {
            if ((field.access & Opcodes.ACC_SYNTHETIC) != 0) continue;
            TypeSignatures.RenderedType type = TypeSignatures.type(field.desc, field.signature);
            if ((field.access & Opcodes.ACC_STATIC) != 0) {
                type.refs().forEach(r -> used.add(r.internalName()));
                continue;
            }
            String containerMultiplicity = type.refs().stream().filter(r -> !r.argument()).findFirst()
                    .map(raw -> multiplicityOf(raw.internalName())).orElse(null);
            for (TypeSignatures.Ref ref : type.refs()) {
                String multiplicity = ref.argument() ? containerMultiplicity : ref.array() ? "*" : null;
                addStructural(source, ref.internalName(), RelationKind.ASSOCIATION, field.name, multiplicity, related);
            }
        }

        for (MethodNode method : node.methods) {
            TypeSignatures.method(method.desc, method.signature).refs().forEach(r -> used.add(r.internalName()));
            used.addAll(bodies.get(node).get(method).types());
        }
        for (String type : used) {
            String target = TypeNames.binaryName(type);
            if (type.equals(node.name) || !classes.containsKey(type) || related.contains(target)) continue;
            related.add(target);
            relations.add(new Relation(source, target, RelationKind.DEPENDENCY, null, null));
        }
    }

    private void addStructural(String source, String targetInternal, RelationKind kind, String label,
                               String multiplicity, Set<String> related) {
        String target = TypeNames.binaryName(targetInternal);
        if (hierarchy.isPlatform(targetInternal) || filter.isExcluded(target)) return;
        if (!relationKeys.add(source + "|" + target + "|" + kind + "|" + label)) return;
        if (!classes.containsKey(targetInternal)) externalTypes.add(targetInternal);
        related.add(target);
        relations.add(new Relation(source, target, kind, label, multiplicity));
    }

    private String multiplicityOf(String container) {
        if (OPTIONAL_CONTAINERS.contains(container)) return "0..1";
        List<String> ancestors = hierarchy.linearization(container);
        return ancestors.stream().anyMatch(MANY_CONTAINERS::contains) ? "*" : null;
    }

    // ---------------------------------------------------------------- types

    private TypeInfo projectType(ClassNode node) {
        Optional<InnerClassNode> inner = node.innerClasses.stream().filter(i -> i.name.equals(node.name)).findFirst();
        int access = inner.map(i -> i.access).orElse(node.access);

        Set<String> modifiers = new LinkedHashSet<>();
        TypeKind kind = kindOf(node);
        if ((access & Opcodes.ACC_ABSTRACT) != 0 && kind == TypeKind.CLASS) modifiers.add("abstract");
        if ((access & Opcodes.ACC_FINAL) != 0 && kind == TypeKind.CLASS) modifiers.add("final");
        if ((access & Opcodes.ACC_STATIC) != 0 && inner.isPresent()) modifiers.add("static");
        if (node.permittedSubclasses != null && !node.permittedSubclasses.isEmpty()) modifiers.add("sealed");

        List<FieldInfo> fields = new ArrayList<>();
        for (FieldNode field : node.fields) {
            if ((field.access & Opcodes.ACC_SYNTHETIC) != 0) continue;
            fields.add(new FieldInfo(field.name, TypeSignatures.type(field.desc, field.signature).display(),
                    Visibility.of(field.access), (field.access & Opcodes.ACC_STATIC) != 0,
                    (field.access & Opcodes.ACC_FINAL) != 0,
                    Annotations.read(field.visibleAnnotations, field.invisibleAnnotations)));
        }

        String outer = inner.map(i -> i.outerName).orElse(null);
        if (outer == null && inner.isPresent()) outer = node.outerClass;
        boolean anonymous = inner.map(i -> i.innerName == null).orElse(false);

        return new TypeInfo(
                TypeNames.binaryName(node.name), TypeNames.simpleName(node.name), TypeNames.packageName(node.name),
                kind, Visibility.of(access), modifiers,
                node.superName == null || IMPLICIT_SUPERTYPES.contains(node.superName) ? null : TypeNames.binaryName(node.superName),
                node.interfaces.stream().map(TypeNames::binaryName).toList(),
                Annotations.read(node.visibleAnnotations, node.invisibleAnnotations),
                Set.of(), fields, new ArrayList<>(methods.get(node.name).values()),
                outer == null ? null : TypeNames.binaryName(outer), anonymous, false, node.sourceFile);
    }

    private static TypeInfo withRoles(TypeInfo type, Stereotypes stereotypes) {
        List<MethodInfo> resolved = type.methods().stream()
                .map(m -> EntryPoints.describe(m, type.annotations()).map(m::withEntryPoint).orElse(m))
                .toList();
        boolean hasMain = resolved.stream().anyMatch(m -> "main".equals(m.endpoint()));
        Set<String> roles = stereotypes.detect(TypeNames.internalName(type.id()), type.annotations(), hasMain);
        return new TypeInfo(type.id(), type.name(), type.packageName(), type.kind(), type.visibility(),
                type.modifiers(), type.superType(), type.interfaces(), type.annotations(), roles, type.fields(),
                resolved, type.outer(), type.anonymous(), false, type.sourceFile());
    }

    private TypeInfo externalType(String internalName) {
        Optional<TypeHierarchy.Header> header = hierarchy.header(internalName);
        TypeKind kind = header.map(h -> (h.access() & Opcodes.ACC_ANNOTATION) != 0 ? TypeKind.ANNOTATION
                : h.isInterface() ? TypeKind.INTERFACE
                : (h.access() & Opcodes.ACC_ENUM) != 0 ? TypeKind.ENUM : TypeKind.CLASS).orElse(TypeKind.CLASS);
        Collection<MethodInfo> called = externalMethods.getOrDefault(internalName, new LinkedHashMap<>()).values();
        return new TypeInfo(TypeNames.binaryName(internalName), TypeNames.simpleName(internalName),
                TypeNames.packageName(internalName), kind, Visibility.PUBLIC, Set.of(),
                header.map(TypeHierarchy.Header::superName).filter(s -> !IMPLICIT_SUPERTYPES.contains(s))
                        .map(TypeNames::binaryName).orElse(null),
                header.map(h -> h.interfaces().stream().map(TypeNames::binaryName).toList()).orElse(List.of()),
                List.of(), Set.of(), List.of(), new ArrayList<>(called), null, false, true, null);
    }

    private static TypeKind kindOf(ClassNode node) {
        if ((node.access & Opcodes.ACC_ANNOTATION) != 0) return TypeKind.ANNOTATION;
        if ((node.access & Opcodes.ACC_INTERFACE) != 0) return TypeKind.INTERFACE;
        if ("java/lang/Enum".equals(node.superName)) return TypeKind.ENUM;
        if ((node.access & Opcodes.ACC_RECORD) != 0 || "java/lang/Record".equals(node.superName)) return TypeKind.RECORD;
        return TypeKind.CLASS;
    }
}
