package br.com.douglasoliveira10.javadraw.model;

/**
 * @param source      caller method id
 * @param target      callee method id
 * @param line        source line of the call, or 0 when unknown
 * @param polymorphic target is only reached through dynamic dispatch
 */
public record CallEdge(String source, String target, CallKind kind, int line, boolean polymorphic) {
}
