package br.com.douglasoliveira10.javadraw.source;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

final class DirectorySource implements ClassSource {

    private final Path root;
    private final boolean library;

    DirectorySource(Path root, boolean library) {
        this.root = root;
        this.library = library;
    }

    @Override
    public void read(Sink sink) throws IOException {
        List<Path> files;
        try (Stream<Path> walk = Files.walk(root)) {
            files = walk.filter(Files::isRegularFile)
                    .filter(p -> ClassSource.isAnalyzableClass(root.relativize(p).toString().replace('\\', '/')))
                    .sorted()
                    .toList();
        }
        for (Path file : files) {
            byte[] bytes = Files.readAllBytes(file);
            if (library) sink.library(bytes);
            else sink.project(bytes);
        }
    }

    @Override
    public String toString() {
        return root.toString();
    }
}
