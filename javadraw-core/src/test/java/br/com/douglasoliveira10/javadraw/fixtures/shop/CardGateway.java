package br.com.douglasoliveira10.javadraw.fixtures.shop;

public class CardGateway extends AbstractGateway {
    @Override
    public void charge(Order order) {
        log("card " + order.getId());
    }
}
