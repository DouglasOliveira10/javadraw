package br.com.douglasoliveira10.javadraw.fixtures.shop;

import java.util.Optional;

public interface OrderRepository {
    Order save(Order order);

    Optional<Order> findById(Long id);
}
