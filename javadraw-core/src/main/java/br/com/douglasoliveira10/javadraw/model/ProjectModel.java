package br.com.douglasoliveira10.javadraw.model;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

public record ProjectModel(Meta meta, List<TypeInfo> types, List<Relation> relations, List<CallEdge> calls) {

    public Optional<TypeInfo> type(String id) {
        return types.stream().filter(t -> t.id().equals(id)).findFirst();
    }

    public Map<String, MethodInfo> methodsById() {
        return types.stream()
                .flatMap(t -> t.methods().stream())
                .collect(Collectors.toMap(MethodInfo::id, Function.identity(), (a, b) -> a));
    }
}
