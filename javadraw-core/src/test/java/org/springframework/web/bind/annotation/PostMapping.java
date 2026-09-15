package org.springframework.web.bind.annotation;

/** Test double of the Spring annotation with the same name. */
public @interface PostMapping {
    String[] value() default {};
}
