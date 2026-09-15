package br.com.douglasoliveira10.javadraw;

/** Which calls to types outside the analyzed project are kept in the call graph. */
public enum ExternalCalls {
    /** Only calls between project methods. */
    NONE,
    /** Calls to libraries (Spring, Hibernate, ...) but not to the JDK. */
    LIBRARIES,
    /** Every call, including {@code java.*}. */
    ALL
}
