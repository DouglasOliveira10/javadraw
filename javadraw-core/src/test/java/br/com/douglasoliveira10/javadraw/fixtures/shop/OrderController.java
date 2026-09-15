package br.com.douglasoliveira10.javadraw.fixtures.shop;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/orders")
public class OrderController {
    private final OrderService service;

    public OrderController(OrderService service) {
        this.service = service;
    }

    @PostMapping
    public Order create(Order order) {
        return service.place(order);
    }

    @GetMapping("/{id}")
    public Order get(Long id) {
        return service.find(id).orElseThrow(OrderNotFoundException::new);
    }
}
