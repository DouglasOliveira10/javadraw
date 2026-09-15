package br.com.douglasoliveira10.javadraw.model;

/**
 * @param label        field name for associations
 * @param multiplicity {@code *} for collections/arrays, {@code 0..1} for optionals, otherwise null
 */
public record Relation(String source, String target, RelationKind kind, String label, String multiplicity) {
}
