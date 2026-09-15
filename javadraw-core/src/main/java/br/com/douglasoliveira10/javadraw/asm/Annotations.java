package br.com.douglasoliveira10.javadraw.asm;

import br.com.douglasoliveira10.javadraw.model.AnnotationInfo;
import org.objectweb.asm.Type;
import org.objectweb.asm.tree.AnnotationNode;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class Annotations {

    private Annotations() {
    }

    @SafeVarargs
    public static List<AnnotationInfo> read(List<? extends AnnotationNode>... groups) {
        List<AnnotationInfo> result = new ArrayList<>();
        for (List<? extends AnnotationNode> group : groups) {
            if (group == null) continue;
            for (AnnotationNode node : group) {
                result.add(toInfo(node));
            }
        }
        return result;
    }

    private static AnnotationInfo toInfo(AnnotationNode node) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (node.values != null) {
            for (int i = 0; i + 1 < node.values.size(); i += 2) {
                values.put((String) node.values.get(i), convert(node.values.get(i + 1)));
            }
        }
        return new AnnotationInfo(Type.getType(node.desc).getClassName(), values);
    }

    private static Object convert(Object value) {
        if (value instanceof Type type) {
            return type.getClassName();
        }
        if (value instanceof String[] enumValue) {
            return enumValue[1];
        }
        if (value instanceof AnnotationNode nested) {
            return "@" + toInfo(nested).simpleName();
        }
        if (value instanceof List<?> list) {
            return list.stream().map(Annotations::convert).toList();
        }
        if (value instanceof Character c) {
            return String.valueOf(c);
        }
        if (value != null && value.getClass().isArray()) {
            int length = java.lang.reflect.Array.getLength(value);
            List<Object> items = new ArrayList<>(length);
            for (int i = 0; i < length; i++) items.add(java.lang.reflect.Array.get(value, i));
            return items;
        }
        return value;
    }
}
