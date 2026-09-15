package br.com.douglasoliveira10.javadraw.asm;

import org.objectweb.asm.Opcodes;
import org.objectweb.asm.Type;
import org.objectweb.asm.signature.SignatureReader;
import org.objectweb.asm.signature.SignatureVisitor;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * Renders field and method generic signatures (or plain descriptors) with simple type names and
 * collects every class referenced by them.
 */
public final class TypeSignatures {

    /**
     * A class referenced by a type.
     *
     * @param internalName referenced class
     * @param argument     appears as a generic type argument rather than as the raw type
     * @param array        appears as an array element type
     */
    public record Ref(String internalName, boolean argument, boolean array) {
    }

    public record RenderedType(String display, List<Ref> refs) {
    }

    public record RenderedMethod(List<String> parameters, String returnType, List<Ref> refs) {
    }

    private TypeSignatures() {
    }

    /** Renders a field type from its generic signature when present, otherwise from its descriptor. */
    public static RenderedType type(String descriptor, String signature) {
        List<Ref> refs = new ArrayList<>();
        String[] display = new String[1];
        new SignatureReader(signature != null ? signature : descriptor)
                .acceptType(new Renderer(s -> display[0] = s, refs, false, false));
        return new RenderedType(display[0], refs);
    }

    public static RenderedMethod method(String descriptor, String signature) {
        List<Ref> refs = new ArrayList<>();
        MethodRenderer renderer = new MethodRenderer(refs);
        try {
            new SignatureReader(signature != null ? signature : descriptor).accept(renderer);
        } catch (RuntimeException malformed) {
            if (signature == null) throw malformed;
            return method(descriptor, null);
        }
        return new RenderedMethod(renderer.parameters, renderer.returnType, refs);
    }

    private static final class MethodRenderer extends SignatureVisitor {
        private final List<Ref> refs;
        private final List<String> parameters = new ArrayList<>();
        private String returnType = "void";

        MethodRenderer(List<Ref> refs) {
            super(Opcodes.ASM9);
            this.refs = refs;
        }

        @Override
        public SignatureVisitor visitClassBound() {
            return discard();
        }

        @Override
        public SignatureVisitor visitInterfaceBound() {
            return discard();
        }

        @Override
        public SignatureVisitor visitParameterType() {
            return new Renderer(parameters::add, refs, false, false);
        }

        @Override
        public SignatureVisitor visitReturnType() {
            return new Renderer(s -> returnType = s, refs, false, false);
        }

        @Override
        public SignatureVisitor visitExceptionType() {
            return discard();
        }

        private static SignatureVisitor discard() {
            return new Renderer(s -> {
            }, new ArrayList<>(), false, false);
        }
    }

    /** Renders one type; nested type arguments and array elements use child renderers. */
    private static final class Renderer extends SignatureVisitor {
        private final StringBuilder out = new StringBuilder();
        private final Consumer<String> onDone;
        private final List<Ref> refs;
        private final boolean argument;
        private final boolean array;
        private boolean openArguments;

        Renderer(Consumer<String> onDone, List<Ref> refs, boolean argument, boolean array) {
            super(Opcodes.ASM9);
            this.onDone = onDone;
            this.refs = refs;
            this.argument = argument;
            this.array = array;
        }

        @Override
        public void visitBaseType(char descriptor) {
            onDone.accept(Type.getType(String.valueOf(descriptor)).getClassName());
        }

        @Override
        public void visitTypeVariable(String name) {
            onDone.accept(name);
        }

        @Override
        public SignatureVisitor visitArrayType() {
            return new Renderer(s -> onDone.accept(s + "[]"), refs, argument, true);
        }

        @Override
        public void visitClassType(String name) {
            refs.add(new Ref(name, argument, array));
            out.append(TypeNames.simpleName(name));
        }

        @Override
        public void visitInnerClassType(String name) {
            closeArguments();
            out.append('.').append(name);
        }

        @Override
        public void visitTypeArgument() {
            openArgument();
            out.append('?');
        }

        @Override
        public SignatureVisitor visitTypeArgument(char wildcard) {
            openArgument();
            String prefix = switch (wildcard) {
                case EXTENDS -> "? extends ";
                case SUPER -> "? super ";
                default -> "";
            };
            return new Renderer(s -> out.append(prefix).append(s), refs, true, false);
        }

        @Override
        public void visitEnd() {
            closeArguments();
            onDone.accept(out.toString());
        }

        private void openArgument() {
            out.append(openArguments ? ", " : "<");
            openArguments = true;
        }

        private void closeArguments() {
            if (openArguments) {
                out.append('>');
                openArguments = false;
            }
        }
    }
}
