package br.com.douglasoliveira10.javadraw.analysis;

import br.com.douglasoliveira10.javadraw.asm.TypeNames;
import br.com.douglasoliveira10.javadraw.graph.TypeHierarchy;
import br.com.douglasoliveira10.javadraw.model.AnnotationInfo;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Function;

/**
 * Detects architectural roles from framework annotations (including meta-annotations declared in the
 * project) and from well-known supertypes.
 */
public final class Stereotypes {

    public static final String APPLICATION = "application";
    public static final String CONTROLLER = "controller";
    public static final String SERVICE = "service";
    public static final String REPOSITORY = "repository";
    public static final String CONFIGURATION = "configuration";
    public static final String ENTITY = "entity";
    public static final String COMPONENT = "component";
    public static final String EXCEPTION = "exception";

    private static final List<String> PRIORITY =
            List.of(APPLICATION, CONTROLLER, SERVICE, REPOSITORY, CONFIGURATION, ENTITY, COMPONENT, EXCEPTION);

    private static final Map<String, String> BY_ANNOTATION = Map.ofEntries(
            Map.entry("org.springframework.boot.autoconfigure.SpringBootApplication", APPLICATION),
            Map.entry("io.quarkus.runtime.annotations.QuarkusMain", APPLICATION),
            Map.entry("org.springframework.stereotype.Controller", CONTROLLER),
            Map.entry("org.springframework.web.bind.annotation.RestController", CONTROLLER),
            Map.entry("org.springframework.web.bind.annotation.ControllerAdvice", CONTROLLER),
            Map.entry("org.springframework.web.bind.annotation.RestControllerAdvice", CONTROLLER),
            Map.entry("jakarta.ws.rs.Path", CONTROLLER),
            Map.entry("javax.ws.rs.Path", CONTROLLER),
            Map.entry("io.micronaut.http.annotation.Controller", CONTROLLER),
            Map.entry("org.springframework.stereotype.Service", SERVICE),
            Map.entry("org.springframework.stereotype.Repository", REPOSITORY),
            Map.entry("io.micronaut.data.annotation.Repository", REPOSITORY),
            Map.entry("org.springframework.context.annotation.Configuration", CONFIGURATION),
            Map.entry("org.springframework.boot.autoconfigure.AutoConfiguration", CONFIGURATION),
            Map.entry("org.springframework.boot.context.properties.ConfigurationProperties", CONFIGURATION),
            Map.entry("jakarta.persistence.Entity", ENTITY),
            Map.entry("javax.persistence.Entity", ENTITY),
            Map.entry("jakarta.persistence.Embeddable", ENTITY),
            Map.entry("javax.persistence.Embeddable", ENTITY),
            Map.entry("jakarta.persistence.MappedSuperclass", ENTITY),
            Map.entry("javax.persistence.MappedSuperclass", ENTITY),
            Map.entry("org.springframework.data.mongodb.core.mapping.Document", ENTITY),
            Map.entry("org.springframework.data.relational.core.mapping.Table", ENTITY),
            Map.entry("org.springframework.stereotype.Component", COMPONENT),
            Map.entry("jakarta.inject.Named", COMPONENT),
            Map.entry("jakarta.inject.Singleton", COMPONENT),
            Map.entry("javax.inject.Named", COMPONENT),
            Map.entry("javax.inject.Singleton", COMPONENT),
            Map.entry("jakarta.enterprise.context.ApplicationScoped", COMPONENT),
            Map.entry("jakarta.enterprise.context.RequestScoped", COMPONENT));

    /** Fallback for in-house frameworks that reuse the conventional names. */
    private static final Map<String, String> BY_SIMPLE_NAME = Map.of(
            "RestController", CONTROLLER,
            "Controller", CONTROLLER,
            "Service", SERVICE,
            "Repository", REPOSITORY,
            "Entity", ENTITY,
            "Configuration", CONFIGURATION,
            "Component", COMPONENT);

    private static final Map<String, String> BY_SUPERTYPE = Map.of(
            "org/springframework/data/repository/Repository", REPOSITORY,
            "java/lang/Throwable", EXCEPTION);

    private final TypeHierarchy hierarchy;
    private final Function<String, List<AnnotationInfo>> projectAnnotations;

    /**
     * @param projectAnnotations annotations declared on a project type (binary name), used to resolve
     *                           meta-annotations such as a custom {@code @UseCase} annotated with {@code @Service}
     */
    public Stereotypes(TypeHierarchy hierarchy, Function<String, List<AnnotationInfo>> projectAnnotations) {
        this.hierarchy = hierarchy;
        this.projectAnnotations = projectAnnotations;
    }

    public Set<String> detect(String internalName, List<AnnotationInfo> annotations, boolean hasMain) {
        Set<String> result = new TreeSet<>(Comparator.comparingInt(PRIORITY::indexOf));
        collect(annotations, result, new HashSet<>());
        List<String> ancestors = hierarchy.linearization(internalName);
        BY_SUPERTYPE.forEach((supertype, stereotype) -> {
            if (ancestors.contains(supertype) && !supertype.equals(internalName)) result.add(stereotype);
        });
        if (hasMain) result.add(APPLICATION);
        return result;
    }

    private void collect(List<AnnotationInfo> annotations, Set<String> result, Set<String> visited) {
        for (AnnotationInfo annotation : annotations) {
            if (!visited.add(annotation.type())) continue;
            String stereotype = BY_ANNOTATION.get(annotation.type());
            if (stereotype == null && !hierarchy.isProject(TypeNames.internalName(annotation.type()))) {
                stereotype = BY_SIMPLE_NAME.get(annotation.simpleName());
            }
            if (stereotype != null) result.add(stereotype);
            List<AnnotationInfo> meta = projectAnnotations.apply(annotation.type());
            if (meta != null) collect(meta, result, visited);
        }
    }
}
