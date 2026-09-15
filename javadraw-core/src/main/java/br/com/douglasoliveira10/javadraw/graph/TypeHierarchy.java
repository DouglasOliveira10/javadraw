package br.com.douglasoliveira10.javadraw.graph;

import org.objectweb.asm.ClassReader;
import org.objectweb.asm.Opcodes;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Supertype/subtype index over project classes, library classes and the JDK of the running JVM.
 * All names are JVM internal names.
 */
public final class TypeHierarchy {

    public record Header(String name, String superName, List<String> interfaces, int access) {
        public boolean isInterface() {
            return (access & Opcodes.ACC_INTERFACE) != 0;
        }

        static Header of(ClassReader reader) {
            return new Header(reader.getClassName(), reader.getSuperName(), List.of(reader.getInterfaces()),
                    reader.getAccess());
        }
    }

    private static final String[] PLATFORM_PREFIXES = {"java/", "jdk/", "sun/", "com/sun/", "kotlin/", "scala/"};

    private final Map<String, Header> known = new HashMap<>();
    private final Set<String> projectTypes = new LinkedHashSet<>();
    private final Map<String, Optional<Header>> platformHeaders = new HashMap<>();
    private final Map<String, Boolean> platformTypes = new HashMap<>();
    private Map<String, Set<String>> projectSubtypes;

    public void addProject(Header header) {
        known.put(header.name(), header);
        projectTypes.add(header.name());
        projectSubtypes = null;
    }

    public void addLibrary(Header header) {
        known.putIfAbsent(header.name(), header);
    }

    public Optional<Header> header(String name) {
        Header header = known.get(name);
        if (header != null) return Optional.of(header);
        return platformHeaders.computeIfAbsent(name, TypeHierarchy::readPlatformHeader);
    }

    public boolean isProject(String name) {
        return projectTypes.contains(name);
    }

    /** Types from the JDK and language runtimes, which are never drawn as nodes. */
    public boolean isPlatform(String name) {
        if (known.containsKey(name)) return false;
        return platformTypes.computeIfAbsent(name, n -> {
            for (String prefix : PLATFORM_PREFIXES) {
                if (n.startsWith(prefix)) return true;
            }
            return ClassLoader.getPlatformClassLoader().getResource(n + ".class") != null;
        });
    }

    /** Superclass followed by implemented interfaces. */
    public List<String> directSupertypes(String name) {
        return header(name).map(h -> {
            List<String> result = new ArrayList<>(h.interfaces().size() + 1);
            if (h.superName() != null) result.add(h.superName());
            result.addAll(h.interfaces());
            return result;
        }).orElse(List.of());
    }

    /**
     * Method resolution order: the type itself, its superclass chain, then every superinterface
     * (breadth first).
     */
    public List<String> linearization(String name) {
        LinkedHashSet<String> order = new LinkedHashSet<>();
        for (String current = name; current != null && order.add(current); ) {
            current = header(current).map(Header::superName).orElse(null);
        }
        Deque<String> queue = new ArrayDeque<>(order);
        while (!queue.isEmpty()) {
            header(queue.poll()).ifPresent(h -> {
                for (String itf : h.interfaces()) {
                    if (order.add(itf)) queue.add(itf);
                }
            });
        }
        return new ArrayList<>(order);
    }

    public boolean isSubtype(String name, String ancestor) {
        return linearization(name).contains(ancestor);
    }

    /** Project types that extend or implement {@code name}, directly or transitively (excluding itself). */
    public Set<String> projectSubtypes(String name) {
        if (projectSubtypes == null) {
            projectSubtypes = new HashMap<>();
            for (String type : projectTypes) {
                for (String ancestor : linearization(type)) {
                    if (!ancestor.equals(type)) {
                        projectSubtypes.computeIfAbsent(ancestor, k -> new LinkedHashSet<>()).add(type);
                    }
                }
            }
        }
        return projectSubtypes.getOrDefault(name, Set.of());
    }

    public Collection<String> projectTypes() {
        return projectTypes;
    }

    private static Optional<Header> readPlatformHeader(String name) {
        try (InputStream in = ClassLoader.getPlatformClassLoader().getResourceAsStream(name + ".class")) {
            return in == null ? Optional.empty() : Optional.of(Header.of(new ClassReader(in)));
        } catch (IOException | RuntimeException e) {
            return Optional.empty();
        }
    }

    static Header headerOf(byte[] bytes) {
        return Header.of(new ClassReader(bytes));
    }
}
