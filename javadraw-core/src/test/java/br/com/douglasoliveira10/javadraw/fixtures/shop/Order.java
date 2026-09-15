package br.com.douglasoliveira10.javadraw.fixtures.shop;

import jakarta.persistence.Entity;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
public class Order {
    private Long id;
    private Customer customer;
    private OrderStatus status = OrderStatus.NEW;
    private final List<OrderItem> items = new ArrayList<>();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public BigDecimal total() {
        return items.stream().map(OrderItem::subtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
