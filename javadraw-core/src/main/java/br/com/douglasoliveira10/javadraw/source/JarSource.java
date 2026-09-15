package br.com.douglasoliveira10.javadraw.source;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Reads jar, war and Spring Boot fat jars. Nested archives under {@code BOOT-INF/lib} or
 * {@code WEB-INF/lib} are read as libraries; {@code BOOT-INF/classes} and {@code WEB-INF/classes}
 * are read as project classes.
 */
final class JarSource implements ClassSource {

    private static final String[] CLASS_PREFIXES = {"BOOT-INF/classes/", "WEB-INF/classes/"};

    private final Path archive;
    private final boolean library;

    JarSource(Path archive, boolean library) {
        this.archive = archive;
        this.library = library;
    }

    @Override
    public void read(Sink sink) throws IOException {
        try (InputStream in = Files.newInputStream(archive)) {
            readArchive(in, library, sink);
        }
    }

    private static void readArchive(InputStream in, boolean library, Sink sink) throws IOException {
        ZipInputStream zip = new ZipInputStream(in);
        ZipEntry entry;
        while ((entry = zip.getNextEntry()) != null) {
            if (entry.isDirectory()) continue;
            String name = entry.getName();
            if (name.endsWith(".jar")) {
                readArchive(new NonClosingInputStream(zip), true, sink);
            } else if (ClassSource.isAnalyzableClass(stripClassPrefix(name))) {
                byte[] bytes = zip.readAllBytes();
                if (library) sink.library(bytes);
                else sink.project(bytes);
            }
        }
    }

    private static String stripClassPrefix(String name) {
        for (String prefix : CLASS_PREFIXES) {
            if (name.startsWith(prefix)) return name.substring(prefix.length());
        }
        return name;
    }

    @Override
    public String toString() {
        return archive.toString();
    }

    /** Lets a nested ZipInputStream read an entry without closing the outer stream. */
    private static final class NonClosingInputStream extends InputStream {
        private final InputStream delegate;

        NonClosingInputStream(InputStream delegate) {
            this.delegate = delegate;
        }

        @Override
        public int read() throws IOException {
            return delegate.read();
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            return delegate.read(b, off, len);
        }

        @Override
        public void close() {
        }
    }
}
