package br.com.douglasoliveira10.javadraw.graph;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TypeFilterTest {

    @Test
    void doubleStarMatchesSubpackages() {
        TypeFilter filter = new TypeFilter(List.of("com.acme.**"), List.of());
        assertThat(filter.isIncluded("com.acme.Order")).isTrue();
        assertThat(filter.isIncluded("com.acme.orders.web.OrderController")).isTrue();
        assertThat(filter.isIncluded("com.acmecorp.Order")).isFalse();
    }

    @Test
    void singleStarStaysInPackage() {
        TypeFilter filter = new TypeFilter(List.of("com.acme.*"), List.of());
        assertThat(filter.isIncluded("com.acme.Order$Line")).isTrue();
        assertThat(filter.isIncluded("com.acme.orders.Order")).isFalse();
    }

    @Test
    void globWithoutPackageMatchesSimpleName() {
        TypeFilter filter = new TypeFilter(List.of(), List.of("*Dto"));
        assertThat(filter.isExcluded("com.acme.OrderDto")).isTrue();
        assertThat(filter.isExcluded("OrderDto")).isTrue();
        assertThat(filter.isExcluded("com.acme.Dtos")).isFalse();
    }

    @Test
    void emptyIncludesAcceptEverything() {
        assertThat(new TypeFilter(List.of(), List.of()).isIncluded("any.Type")).isTrue();
    }
}
