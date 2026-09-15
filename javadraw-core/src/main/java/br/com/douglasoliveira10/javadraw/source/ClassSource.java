package br.com.douglasoliveira10.javadraw.source;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * A location that provides class files: a directory of {@code .class} files or a jar/war archive.
 */
public interface ClassSource {

    void read(Sink sink) throws IOException;

    interface Sink {
        /** A class that belongs to the analyzed project. */
        void project(byte[] bytes);

        /** A dependency class, used only to resolve the type hierarchy. */
        void library(byte[] bytes);
    }

    /** Analyzed project input. Libraries bundled in fat jars (BOOT-INF/lib, WEB-INF/lib) are read as libraries. */
    static ClassSource input(Path path) {
        return Files.isDirectory(path) ? new DirectorySource(path, false) : new JarSource(path, false);
    }

    /** Classpath entry: every class is treated as a library. */
    static ClassSource classpath(Path path) {
        return Files.isDirectory(path) ? new DirectorySource(path, true) : new JarSource(path, true);
    }

    static boolean isAnalyzableClass(String entryName) {
        if (!entryName.endsWith(".class")) return false;
        String file = entryName.substring(entryName.lastIndexOf('/') + 1);
        return !file.equals("module-info.class") && !file.equals("package-info.class")
                && !entryName.startsWith("META-INF/versions/");
    }
}
