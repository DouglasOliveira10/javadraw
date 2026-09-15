package br.com.douglasoliveira10.javadraw.export;

import br.com.douglasoliveira10.javadraw.model.ProjectModel;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** Serializes a {@link ProjectModel} to the JSON document consumed by the JavaDraw UI. */
public final class GraphJsonWriter {

    private final ObjectMapper mapper;

    public GraphJsonWriter() {
        this(false);
    }

    public GraphJsonWriter(boolean pretty) {
        this.mapper = JsonMapper.builder()
                .serializationInclusion(JsonInclude.Include.NON_EMPTY)
                .configure(SerializationFeature.INDENT_OUTPUT, pretty)
                .build();
    }

    public void write(ProjectModel model, OutputStream out) throws IOException {
        mapper.writeValue(out, model);
    }

    public void write(ProjectModel model, Path file) throws IOException {
        Path parent = file.toAbsolutePath().getParent();
        if (parent != null) Files.createDirectories(parent);
        try (OutputStream out = Files.newOutputStream(file)) {
            write(model, out);
        }
    }

    public String toJson(ProjectModel model) {
        try {
            return mapper.writeValueAsString(model);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
