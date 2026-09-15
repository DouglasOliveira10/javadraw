package br.com.douglasoliveira10.javadraw.fixtures.shop;

import java.math.BigDecimal;

public record OrderItem(String sku, int quantity, BigDecimal price) {
    public BigDecimal subtotal() {
        return price.multiply(BigDecimal.valueOf(quantity));
    }
}
