package br.com.douglasoliveira10.javadraw.analysis;

import br.com.douglasoliveira10.javadraw.model.AnnotationInfo;
import br.com.douglasoliveira10.javadraw.model.MethodInfo;
import br.com.douglasoliveira10.javadraw.model.Visibility;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Detects methods triggered from outside the application and describes the trigger, e.g.
 * {@code GET /orders/{id}}, {@code @KafkaListener orders} or {@code main}.
 */
public final class EntryPoints {

    private static final Map<String, String> SPRING_HTTP = Map.of(
            "org.springframework.web.bind.annotation.GetMapping", "GET",
            "org.springframework.web.bind.annotation.PostMapping", "POST",
            "org.springframework.web.bind.annotation.PutMapping", "PUT",
            "org.springframework.web.bind.annotation.DeleteMapping", "DELETE",
            "org.springframework.web.bind.annotation.PatchMapping", "PATCH",
            "org.springframework.web.bind.annotation.RequestMapping", "");

    private static final Set<String> JAX_RS_PACKAGES = Set.of("jakarta.ws.rs", "javax.ws.rs");
    private static final Set<String> JAX_RS_METHODS = Set.of("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS");
    private static final String MICRONAUT_HTTP = "io.micronaut.http.annotation";
    private static final Set<String> MICRONAUT_METHODS = Set.of("Get", "Post", "Put", "Delete", "Patch", "Head", "Options");

    /** Annotation simple name → attributes that name the trigger source. */
    private static final Map<String, List<String>> TRIGGERS = Map.ofEntries(
            Map.entry("KafkaListener", List.of("topics", "topicPattern", "id")),
            Map.entry("RabbitListener", List.of("queues", "id")),
            Map.entry("JmsListener", List.of("destination")),
            Map.entry("SqsListener", List.of("value", "queueNames")),
            Map.entry("StreamListener", List.of("value")),
            Map.entry("EventListener", List.of("classes", "value")),
            Map.entry("TransactionalEventListener", List.of("classes", "value")),
            Map.entry("Scheduled", List.of("cron", "fixedRate", "fixedDelay", "fixedRateString", "fixedDelayString")),
            Map.entry("MessageMapping", List.of("value")),
            Map.entry("QueryMapping", List.of("name", "value")),
            Map.entry("MutationMapping", List.of("name", "value")),
            Map.entry("SubscriptionMapping", List.of("name", "value")),
            Map.entry("SchemaMapping", List.of("field", "value")),
            Map.entry("Incoming", List.of("value")),
            Map.entry("Consumes", List.of("value")));

    private EntryPoints() {
    }

    public static Optional<String> describe(MethodInfo method, List<AnnotationInfo> typeAnnotations) {
        if (method.isConstructor()) return Optional.empty();
        for (AnnotationInfo annotation : method.annotations()) {
            Optional<String> described = http(annotation, method.annotations(), typeAnnotations).or(() -> trigger(annotation));
            if (described.isPresent()) return described;
        }
        if (isMain(method)) return Optional.of("main");
        return Optional.empty();
    }

    private static Optional<String> http(AnnotationInfo annotation, List<AnnotationInfo> methodAnnotations,
                                         List<AnnotationInfo> typeAnnotations) {
        String type = annotation.type();
        String packageName = type.substring(0, Math.max(type.lastIndexOf('.'), 0));
        String simple = annotation.simpleName();

        if (SPRING_HTTP.containsKey(type)) {
            String verb = SPRING_HTTP.get(type);
            if (verb.isEmpty()) {
                verb = first(annotation, "method").orElse("ANY");
            }
            String base = typeAnnotations.stream()
                    .filter(a -> a.type().equals("org.springframework.web.bind.annotation.RequestMapping"))
                    .findFirst().flatMap(a -> first(a, "path", "value")).orElse("");
            return Optional.of(verb + " " + joinPath(base, first(annotation, "path", "value").orElse("")));
        }
        if (JAX_RS_PACKAGES.contains(packageName) && JAX_RS_METHODS.contains(simple)) {
            String pathType = packageName + ".Path";
            return Optional.of(simple + " " + joinPath(pathOf(typeAnnotations, pathType), pathOf(methodAnnotations, pathType)));
        }
        if (MICRONAUT_HTTP.equals(packageName) && MICRONAUT_METHODS.contains(simple)) {
            String base = typeAnnotations.stream()
                    .filter(a -> a.type().equals(MICRONAUT_HTTP + ".Controller"))
                    .findFirst().flatMap(a -> first(a, "value")).orElse("");
            return Optional.of(simple.toUpperCase() + " " + joinPath(base, first(annotation, "value", "uri").orElse("")));
        }
        return Optional.empty();
    }

    private static String pathOf(List<AnnotationInfo> annotations, String pathType) {
        return annotations.stream().filter(a -> a.type().equals(pathType)).findFirst()
                .flatMap(a -> first(a, "value")).orElse("");
    }

    private static Optional<String> trigger(AnnotationInfo annotation) {
        List<String> attributes = TRIGGERS.get(annotation.simpleName());
        if (attributes == null) return Optional.empty();
        String detail = first(annotation, attributes.toArray(String[]::new)).orElse("");
        return Optional.of(("@" + annotation.simpleName() + " " + detail).trim());
    }

    private static boolean isMain(MethodInfo method) {
        return method.name().equals("main") && method.visibility() != Visibility.PRIVATE
                && (method.descriptor().equals("([Ljava/lang/String;)V") || method.descriptor().equals("()V"));
    }

    private static Optional<String> first(AnnotationInfo annotation, String... names) {
        for (String name : names) {
            Object value = annotation.value(name);
            if (value instanceof List<?> list && !list.isEmpty()) {
                return Optional.of(String.valueOf(list.getFirst()));
            }
            if (value != null && !(value instanceof List<?>)) {
                return Optional.of(String.valueOf(value));
            }
        }
        return Optional.empty();
    }

    static String joinPath(String base, String path) {
        String joined = ("/" + base + "/" + path).replaceAll("/+", "/");
        return joined.length() > 1 && joined.endsWith("/") ? joined.substring(0, joined.length() - 1) : joined;
    }
}
