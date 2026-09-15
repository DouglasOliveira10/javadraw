package br.com.douglasoliveira10.javadraw.fixtures.shop;

public class ShopApplication {
    public static void main(String[] args) {
        new OrderController(new OrderService(new InMemoryOrderRepository(), java.util.List.of(new CardGateway(), new PixGateway())));
    }
}
