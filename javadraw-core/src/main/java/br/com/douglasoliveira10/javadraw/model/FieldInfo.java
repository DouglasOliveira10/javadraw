package br.com.douglasoliveira10.javadraw.model;

import java.util.List;

/**
 * @param type display type with simple names, e.g. {@code List<Order>}
 */
public record FieldInfo(
        String name,
        String type,
        Visibility visibility,
        boolean isStatic,
        boolean isFinal,
        List<AnnotationInfo> annotations) {
}
