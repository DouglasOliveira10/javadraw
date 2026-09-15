package br.com.douglasoliveira10.javadraw;

import br.com.douglasoliveira10.javadraw.export.GraphJsonWriter;
import br.com.douglasoliveira10.javadraw.model.CallEdge;
import br.com.douglasoliveira10.javadraw.model.CallKind;
import br.com.douglasoliveira10.javadraw.model.MethodInfo;
import br.com.douglasoliveira10.javadraw.model.ProjectModel;
import br.com.douglasoliveira10.javadraw.model.Relation;
import br.com.douglasoliveira10.javadraw.model.RelationKind;
import br.com.douglasoliveira10.javadraw.model.TypeInfo;
import br.com.douglasoliveira10.javadraw.model.TypeKind;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class AnalyzerTest {

    private static final String SHOP = "br.com.douglasoliveira10.javadraw.fixtures.shop.";

    private static ProjectModel model;

    @BeforeAll
    static void analyze() throws Exception {
        model = JavaDraw.analyzer()
                .input(testClasses())
                .include(SHOP + "**")
                .name("shop")
                .analyze();
    }

    static Path testClasses() throws URISyntaxException {
        return Path.of(AnalyzerTest.class.getProtectionDomain().getCodeSource().getLocation().toURI());
    }

    @Test
    void detectsTypeKinds() {
        assertThat(type("Order").kind()).isEqualTo(TypeKind.CLASS);
        assertThat(type("OrderItem").kind()).isEqualTo(TypeKind.RECORD);
        assertThat(type("OrderStatus").kind()).isEqualTo(TypeKind.ENUM);
        assertThat(type("OrderRepository").kind()).isEqualTo(TypeKind.INTERFACE);
        assertThat(type("AbstractGateway").modifiers()).contains("abstract");
        assertThat(model.types()).noneMatch(t -> t.id().startsWith("org.springframework"));
    }

    @Test
    void rendersMembersWithSimpleNames() {
        TypeInfo service = type("OrderService");
        assertThat(service.fields()).anySatisfy(f -> {
            assertThat(f.name()).isEqualTo("gateways");
            assertThat(f.type()).isEqualTo("List<PaymentGateway>");
        });
        assertThat(method(service, "place").signature()).isEqualTo("place(Order order): Order");
        assertThat(method(service, "find").signature()).isEqualTo("find(Long id): Optional<Order>");
        assertThat(service.methods()).noneMatch(m -> m.name().startsWith("lambda$"));
        assertThat(method(type("Order"), "getId").accessor()).isTrue();
        assertThat(method(type("Order"), "setId").accessor()).isTrue();
        assertThat(method(type("Order"), "total").accessor()).isFalse();
        assertThat(method(service, "place").line()).isPositive();
        assertThat(method(type("OrderStatus"), "values").generated()).isTrue();
        assertThat(method(type("OrderItem"), "toString").generated()).isTrue();
        assertThat(method(type("OrderItem"), "subtotal").generated()).isFalse();
    }

    @Test
    void detectsStructuralRelations() {
        assertThat(relation("InMemoryOrderRepository", "OrderRepository", RelationKind.IMPLEMENTS)).isPresent();
        assertThat(relation("CardGateway", "AbstractGateway", RelationKind.EXTENDS)).isPresent();
        assertThat(relation("OrderService", "PaymentGateway", RelationKind.ASSOCIATION))
                .hasValueSatisfying(r -> {
                    assertThat(r.label()).isEqualTo("gateways");
                    assertThat(r.multiplicity()).isEqualTo("*");
                });
        assertThat(relation("Order", "OrderItem", RelationKind.ASSOCIATION))
                .hasValueSatisfying(r -> assertThat(r.multiplicity()).isEqualTo("*"));
        assertThat(relation("Order", "Customer", RelationKind.ASSOCIATION))
                .hasValueSatisfying(r -> assertThat(r.multiplicity()).isNull());
        assertThat(relation("OrderController", "OrderNotFoundException", RelationKind.DEPENDENCY)).isPresent();
        assertThat(relation("OrderController", "OrderService", RelationKind.DEPENDENCY))
                .as("association already covers the dependency").isEmpty();
        assertThat(model.relations()).noneMatch(r -> r.target().startsWith("java."));
    }

    @Test
    void detectsStereotypesAndEntryPoints() {
        assertThat(type("OrderController").stereotypes()).containsExactly("controller");
        assertThat(type("OrderService").stereotypes()).containsExactly("service");
        assertThat(type("InMemoryOrderRepository").stereotypes()).containsExactly("repository");
        assertThat(type("Order").stereotypes()).containsExactly("entity");
        assertThat(type("OrderNotFoundException").stereotypes()).containsExactly("exception");
        assertThat(type("ShopApplication").stereotypes()).containsExactly("application");

        TypeInfo controller = type("OrderController");
        assertThat(method(controller, "create").endpoint()).isEqualTo("POST /orders");
        assertThat(method(controller, "get").endpoint()).isEqualTo("GET /orders/{id}");
        assertThat(method(type("ShopApplication"), "main").entryPoint()).isTrue();
        assertThat(method(type("OrderService"), "place").entryPoint()).isFalse();
    }

    @Test
    void buildsCallGraph() {
        assertThat(call("OrderController#create", "OrderService#place")).hasValueSatisfying(c ->
                assertThat(c.kind()).isEqualTo(CallKind.VIRTUAL));
        assertThat(call("OrderService#place", "PaymentGateway#charge"))
                .as("call inside a lambda is attributed to the creating method")
                .hasValueSatisfying(c -> assertThat(c.kind()).isEqualTo(CallKind.INTERFACE));
        assertThat(call("OrderService#place", "OrderRepository#save")).isPresent();
        assertThat(call("OrderService#find", "OrderService#enrich")).hasValueSatisfying(c ->
                assertThat(c.kind()).isEqualTo(CallKind.DYNAMIC));
        assertThat(call("OrderController#get", "OrderNotFoundException#<init>")).isPresent();
        assertThat(call("CardGateway#charge", "AbstractGateway#log"))
                .as("inherited method resolves to its declaring class").isPresent();
    }

    @Test
    void addsDispatchEdgesToImplementations() {
        assertThat(call("PaymentGateway#charge", "CardGateway#charge")).hasValueSatisfying(c -> {
            assertThat(c.kind()).isEqualTo(CallKind.OVERRIDE);
            assertThat(c.polymorphic()).isTrue();
        });
        assertThat(call("PaymentGateway#charge", "PixGateway#charge")).isPresent();
        assertThat(call("OrderRepository#save", "InMemoryOrderRepository#save")).isPresent();
    }

    @Test
    void skipsJdkCallsByDefault() {
        assertThat(model.calls()).noneMatch(c -> c.target().startsWith("java."));
        assertThat(model.types()).noneMatch(TypeInfo::external);
    }

    @Test
    void keepsTypesOutsideIncludesAsExternal() throws Exception {
        ProjectModel partial = JavaDraw.analyzer()
                .input(testClasses())
                .include(SHOP + "Order*")
                .exclude("*Exception")
                .analyze();

        assertThat(partial.type(SHOP + "OrderService")).hasValueSatisfying(t -> assertThat(t.external()).isFalse());
        assertThat(partial.type(SHOP + "PaymentGateway")).hasValueSatisfying(t -> {
            assertThat(t.external()).isTrue();
            assertThat(t.kind()).isEqualTo(TypeKind.INTERFACE);
            assertThat(t.methods()).extracting(MethodInfo::name).contains("charge");
        });
        assertThat(partial.type(SHOP + "OrderNotFoundException")).isEmpty();
        assertThat(partial.calls()).noneMatch(c -> c.target().contains("OrderNotFoundException"));
    }

    @Test
    void writesJson() throws Exception {
        JsonNode json = new ObjectMapper().readTree(new GraphJsonWriter().toJson(model));
        assertThat(json.at("/meta/name").asText()).isEqualTo("shop");
        assertThat(json.at("/types").size()).isEqualTo(model.types().size());
        assertThat(json.at("/calls/0/source").asText()).contains("#");
    }

    private static TypeInfo type(String simpleName) {
        return model.type(SHOP + simpleName).orElseThrow(() -> new AssertionError("type not found: " + simpleName));
    }

    private static MethodInfo method(TypeInfo type, String name) {
        return type.methods().stream().filter(m -> m.name().equals(name)).findFirst()
                .orElseThrow(() -> new AssertionError("method not found: " + type.name() + "#" + name));
    }

    private static Optional<Relation> relation(String source, String target, RelationKind kind) {
        return model.relations().stream()
                .filter(r -> r.source().equals(SHOP + source) && r.target().equals(SHOP + target) && r.kind() == kind)
                .findFirst();
    }

    /** Matches method ids by {@code Type#method} prefix, ignoring descriptors. */
    private static Optional<CallEdge> call(String source, String target) {
        return model.calls().stream()
                .filter(c -> c.source().startsWith(SHOP + source + "(") && c.target().startsWith(SHOP + target + "("))
                .findFirst();
    }
}
