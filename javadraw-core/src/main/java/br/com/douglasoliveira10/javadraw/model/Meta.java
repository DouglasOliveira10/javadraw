package br.com.douglasoliveira10.javadraw.model;

/**
 * @param generatedAt ISO-8601 instant
 */
public record Meta(String name, String generatedAt, String version) {
}
