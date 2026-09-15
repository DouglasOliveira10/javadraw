package br.com.douglasoliveira10.javadraw.fixtures.shop;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class OrderService {
    private final OrderRepository repository;
    private final List<PaymentGateway> gateways;

    public OrderService(OrderRepository repository, List<PaymentGateway> gateways) {
        this.repository = repository;
        this.gateways = gateways;
    }

    public Order place(Order order) {
        gateways.forEach(gateway -> gateway.charge(order));
        return repository.save(order);
    }

    public Optional<Order> find(Long id) {
        return repository.findById(id).map(this::enrich);
    }

    private Order enrich(Order order) {
        return order;
    }
}
