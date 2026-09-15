package br.com.douglasoliveira10.javadraw.asm;

/**
 * Conversions between JVM internal names ({@code com/acme/Outer$Inner}) and display names.
 */
public final class TypeNames {

    private TypeNames() {
    }

    /** {@code com/acme/Outer$Inner} → {@code com.acme.Outer$Inner}. */
    public static String binaryName(String internalName) {
        return internalName.replace('/', '.');
    }

    /** {@code com.acme.Outer$Inner} → {@code com/acme/Outer$Inner}. */
    public static String internalName(String binaryName) {
        return binaryName.replace('.', '/');
    }

    /** {@code com/acme/Outer$Inner} → {@code com.acme}. */
    public static String packageName(String name) {
        String binary = binaryName(name);
        int dot = binary.lastIndexOf('.');
        return dot < 0 ? "" : binary.substring(0, dot);
    }

    /** {@code com/acme/Outer$Inner} → {@code Outer.Inner}; anonymous classes keep {@code Outer$1}. */
    public static String simpleName(String name) {
        String binary = binaryName(name);
        String simple = binary.substring(binary.lastIndexOf('.') + 1);
        StringBuilder out = new StringBuilder(simple.length());
        for (int i = 0; i < simple.length(); i++) {
            char c = simple.charAt(i);
            boolean nestedSeparator = c == '$' && i > 0 && i + 1 < simple.length()
                    && !Character.isDigit(simple.charAt(i + 1));
            out.append(nestedSeparator ? '.' : c);
        }
        return out.toString();
    }

    public static String methodId(String ownerInternalName, String name, String descriptor) {
        return binaryName(ownerInternalName) + "#" + name + descriptor;
    }
}
