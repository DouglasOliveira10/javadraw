package br.com.douglasoliveira10.javadraw.model;

public enum RelationKind {
    /** Class extends class, or interface extends interface. */
    EXTENDS,
    /** Class implements interface. */
    IMPLEMENTS,
    /** A field holds a reference to the target type. */
    ASSOCIATION,
    /** The target type is used in signatures or method bodies. */
    DEPENDENCY
}
