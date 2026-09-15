package br.com.douglasoliveira10.javadraw.model;

public enum CallKind {
    STATIC,
    VIRTUAL,
    INTERFACE,
    /** Constructors, private methods and {@code super} calls. */
    SPECIAL,
    /** Method references created through {@code invokedynamic}. */
    DYNAMIC,
    /** Dispatch from an overridden/implemented method to an overriding one (class hierarchy analysis). */
    OVERRIDE
}
