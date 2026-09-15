package br.com.douglasoliveira10.javadraw.cli;

import br.com.douglasoliveira10.javadraw.ExternalCalls;
import br.com.douglasoliveira10.javadraw.JavaDraw;
import br.com.douglasoliveira10.javadraw.export.GraphJsonWriter;
import br.com.douglasoliveira10.javadraw.model.ProjectModel;
import br.com.douglasoliveira10.javadraw.model.TypeInfo;
import picocli.CommandLine;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;
import picocli.CommandLine.Parameters;

import java.awt.Desktop;
import java.io.File;
import java.io.IOException;
import java.io.PrintWriter;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

@Command(
        name = "javadraw",
        mixinStandardHelpOptions = true,
        versionProvider = Main.Version.class,
        sortOptions = false,
        description = "Analyzes Java bytecode and generates an interactive diagram of classes and call flows.",
        footer = {"", "Examples:",
                "  javadraw target/classes --open",
                "  javadraw app.jar -i 'com.acme.**' -o docs/architecture.html",
                "  javadraw target/classes -cp 'target/dependency/*' --external-calls none"})
public final class Main implements Callable<Integer> {

    @Parameters(arity = "1..*", paramLabel = "INPUT",
            description = "Class directories, jars, wars or Spring Boot fat jars to analyze.")
    private List<Path> inputs;

    @Option(names = {"-o", "--out"}, defaultValue = "javadraw.html", paramLabel = "FILE",
            description = "HTML file to generate (default: ${DEFAULT-VALUE}).")
    private Path out;

    @Option(names = {"-i", "--include"}, paramLabel = "GLOB",
            description = "Only draw matching types, e.g. 'com.acme.**'. Other project types become external. Repeatable.")
    private List<String> includes = new ArrayList<>();

    @Option(names = {"-e", "--exclude"}, paramLabel = "GLOB",
            description = "Remove matching types, e.g. '**.dto.**' or '*Test'. Repeatable.")
    private List<String> excludes = new ArrayList<>();

    @Option(names = {"-cp", "--classpath"}, paramLabel = "PATH",
            description = "Dependencies used to resolve the type hierarchy, separated by ':' (';' on Windows). "
                          + "'dir/*' adds every jar in dir.")
    private String classpath;

    @Option(names = "--external-calls", defaultValue = "LIBRARIES", paramLabel = "MODE",
            description = "Calls to non-project types to keep: ${COMPLETION-CANDIDATES} (default: ${DEFAULT-VALUE}).")
    private ExternalCalls externalCalls;

    @Option(names = {"-n", "--name"}, description = "Project name shown in the diagram.")
    private String name;

    @Option(names = "--json", paramLabel = "FILE", description = "Also write the raw graph JSON to FILE.")
    private Path json;

    @Option(names = "--open", description = "Open the generated page in the default browser.")
    private boolean open;

    @CommandLine.Spec
    private CommandLine.Model.CommandSpec spec;

    public static void main(String[] args) {
        System.exit(commandLine().execute(args));
    }

    static CommandLine commandLine() {
        return new CommandLine(new Main()).setCaseInsensitiveEnumValuesAllowed(true);
    }

    @Override
    public Integer call() throws IOException {
        PrintWriter console = spec.commandLine().getOut();
        long started = System.nanoTime();

        ProjectModel model = JavaDraw.analyzer()
                .inputs(inputs)
                .classpath(expandClasspath(classpath))
                .include(includes.toArray(String[]::new))
                .exclude(excludes.toArray(String[]::new))
                .externalCalls(externalCalls)
                .name(name)
                .analyze();

        new HtmlRenderer().write(model, out);
        if (json != null) new GraphJsonWriter(true).write(model, json);

        long projectTypes = model.types().stream().filter(t -> !t.external()).count();
        long methods = model.types().stream().filter(t -> !t.external()).mapToLong(t -> t.methods().size()).sum();
        long entryPoints = model.types().stream().map(TypeInfo::methods).flatMap(List::stream)
                .filter(m -> m.entryPoint()).count();
        console.printf("Analyzed %d types, %d methods, %d relations, %d calls, %d entry points in %d ms%n",
                projectTypes, methods, model.relations().size(), model.calls().size(), entryPoints,
                (System.nanoTime() - started) / 1_000_000);
        console.printf("Diagram written to %s%n", out.toAbsolutePath().normalize());
        if (json != null) console.printf("Graph JSON written to %s%n", json.toAbsolutePath().normalize());
        console.flush();

        if (open) openInBrowser(out);
        return 0;
    }

    static List<Path> expandClasspath(String classpath) throws IOException {
        List<Path> result = new ArrayList<>();
        if (classpath == null || classpath.isBlank()) return result;
        for (String entry : classpath.split(File.pathSeparator)) {
            if (entry.isBlank()) continue;
            if (entry.endsWith("*")) {
                Path dir = Path.of(entry.substring(0, entry.length() - 1));
                if (!Files.isDirectory(dir)) continue;
                try (DirectoryStream<Path> jars = Files.newDirectoryStream(dir, "*.{jar,war}")) {
                    jars.forEach(result::add);
                }
            } else {
                result.add(Path.of(entry));
            }
        }
        return result;
    }

    private void openInBrowser(Path file) {
        // OS launchers avoid initializing AWT (which shows a Dock icon on macOS); Desktop is the fallback.
        String os = System.getProperty("os.name").toLowerCase();
        String command = os.contains("mac") ? "open" : os.contains("win") ? "explorer" : "xdg-open";
        try {
            new ProcessBuilder(command, file.toAbsolutePath().toString()).inheritIO().start();
        } catch (IOException launcherFailed) {
            browseWithDesktop(file);
        }
    }

    private void browseWithDesktop(Path file) {
        try {
            Desktop.getDesktop().browse(file.toAbsolutePath().toUri());
        } catch (IOException | UnsupportedOperationException e) {
            spec.commandLine().getErr().println("Could not open browser: " + e.getMessage());
        }
    }

    static final class Version implements CommandLine.IVersionProvider {
        @Override
        public String[] getVersion() {
            return new String[]{"javadraw " + JavaDraw.version()};
        }
    }
}
