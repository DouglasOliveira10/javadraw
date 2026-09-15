package br.com.douglasoliveira10.javadraw.model;

import java.util.Map;

/**
 * @param type   fully qualified annotation type
 * @param values annotation attributes converted to JSON friendly values (strings, numbers, booleans, lists)
 */
public record AnnotationInfo(String type, Map<String, Object> values) {

    public String simpleName() {
        return type.substring(type.lastIndexOf('.') + 1);
    }

    public Object value(String name) {
        return values.get(name);
    }
}
