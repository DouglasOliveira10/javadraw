package br.com.douglasoliveira10.javadraw;

import br.com.douglasoliveira10.javadraw.asm.TypeNames;
import br.com.douglasoliveira10.javadraw.graph.ModelBuilder;
import br.com.douglasoliveira10.javadraw.graph.TypeFilter;
import br.com.douglasoliveira10.javadraw.graph.TypeHierarchy;
import br.com.douglasoliveira10.javadraw.model.Meta;
import br.com.douglasoliveira10.javadraw.model.ProjectModel;
import br.com.douglasoliveira10.javadraw.source.ClassSource;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.tree.ClassNode;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Configures and runs the bytecode analysis.
 *
 * <pre>{@code
 * ProjectModel model = JavaDraw.analyzer()
 *         .input(Path.of("target/classes"))
 *         .include("com.acme.**")
 *         .analyze();
 * }</pre>
 */
public final class Analyzer {

    private final List<Path> inputs = new ArrayList<>();
    private final List<Path> classpath = new ArrayList<>();
    private final List<String> includes = new ArrayList<>();
    private final List<String> excludes = new ArrayList<>();
    private ExternalCalls externalCalls = ExternalCalls.LIBRARIES;
    private String name;

    Analyzer() {
    }

    /** Directory of class files, jar, war or Spring Boot fat jar to analyze. */
    public Analyzer input(Path... paths) {
        inputs.addAll(List.of(paths));
        return this;
    }

    public Analyzer inputs(Collection<Path> paths) {
        inputs.addAll(paths);
        return this;
    }

    /** Dependencies used only to resolve the type hierarchy. */
    public Analyzer classpath(Collection<Path> paths) {
        classpath.addAll(paths);
        return this;
    }

    /** Glob over class names, e.g. {@code com.acme.**}. Types outside the includes are drawn as external. */
    public Analyzer include(String... globs) {
        includes.addAll(List.of(globs));
        return this;
    }

    /** Glob over class names removed from the model entirely, e.g. {@code **.generated.**}. */
    public Analyzer exclude(String... globs) {
        excludes.addAll(List.of(globs));
        return this;
    }

    public Analyzer externalCalls(ExternalCalls externalCalls) {
        this.externalCalls = externalCalls;
        return this;
    }

    public Analyzer name(String name) {
        this.name = name;
        return this;
    }

    public ProjectModel analyze() throws IOException {
        if (inputs.isEmpty()) throw new IllegalStateException("No input configured");
        TypeFilter filter = new TypeFilter(includes, excludes);
        TypeHierarchy hierarchy = new TypeHierarchy();
        Map<String, ClassNode> classes = new TreeMap<>();

        ClassSource.Sink sink = new ClassSource.Sink() {
            @Override
            public void project(byte[] bytes) {
                ClassNode node = new ClassNode();
                new ClassReader(bytes).accept(node, ClassReader.SKIP_FRAMES);
                String binaryName = TypeNames.binaryName(node.name);
                if (filter.isExcluded(binaryName)) return;
                hierarchy.addProject(new TypeHierarchy.Header(node.name, node.superName, node.interfaces, node.access));
                if (filter.isIncluded(binaryName)) classes.put(node.name, node);
            }

            @Override
            public void library(byte[] bytes) {
                ClassReader reader = new ClassReader(bytes);
                hierarchy.addLibrary(new TypeHierarchy.Header(reader.getClassName(), reader.getSuperName(),
                        List.of(reader.getInterfaces()), reader.getAccess()));
            }
        };

        for (Path input : inputs) {
            requireExists(input).read(sink);
        }
        for (Path entry : classpath) {
            if (Files.exists(entry)) ClassSource.classpath(entry).read(sink);
        }

        Meta meta = new Meta(name != null ? name : defaultName(), Instant.now().toString(), JavaDraw.version());
        return new ModelBuilder(classes, hierarchy, filter, externalCalls).build(meta);
    }

    private static ClassSource requireExists(Path input) {
        if (!Files.exists(input)) throw new UncheckedIOException(new IOException("Input not found: " + input));
        return ClassSource.input(input);
    }

    private String defaultName() {
        Path first = inputs.getFirst().toAbsolutePath().normalize();
        Path fileName = first.getFileName();
        if (fileName == null) return "project";
        String candidate = fileName.toString();
        // target/classes → use the module directory name
        if ((candidate.equals("classes") || candidate.equals("main")) && first.getParent() != null
                && first.getParent().getParent() != null) {
            return first.getParent().getParent().getFileName().toString();
        }
        return candidate.replaceFirst("\\.(jar|war)$", "");
    }
}
