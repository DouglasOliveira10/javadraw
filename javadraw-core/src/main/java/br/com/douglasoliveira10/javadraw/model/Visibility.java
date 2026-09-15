package br.com.douglasoliveira10.javadraw.model;

import org.objectweb.asm.Opcodes;

public enum Visibility {
    PUBLIC, PROTECTED, PACKAGE, PRIVATE;

    public static Visibility of(int access) {
        if ((access & Opcodes.ACC_PUBLIC) != 0) return PUBLIC;
        if ((access & Opcodes.ACC_PROTECTED) != 0) return PROTECTED;
        if ((access & Opcodes.ACC_PRIVATE) != 0) return PRIVATE;
        return PACKAGE;
    }
}
