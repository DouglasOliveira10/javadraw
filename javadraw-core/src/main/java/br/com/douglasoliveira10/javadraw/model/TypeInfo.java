package br.com.douglasoliveira10.javadraw.model;

import java.util.List;
import java.util.Set;

/**
 * @param id          binary name, e.g. {@code com.acme.Outer$Inner}
 * @param name        display name, e.g. {@code Outer.Inner}
 * @param modifiers   {@code abstract}, {@code final}, {@code static}, {@code sealed}
 * @param stereotypes architectural roles such as {@code controller}, {@code service}, {@code entity}
 * @param outer       enclosing type id for nested/anonymous classes
 * @param external    referenced by the project but not part of the analyzed inputs
 */
public record TypeInfo(
        String id,
        String name,
        String packageName,
        TypeKind kind,
        Visibility visibility,
        Set<String> modifiers,
        String superType,
        List<String> interfaces,
        List<AnnotationInfo> annotations,
        Set<String> stereotypes,
        List<FieldInfo> fields,
        List<MethodInfo> methods,
        String outer,
        boolean anonymous,
        boolean external,
        String sourceFile) {
}
