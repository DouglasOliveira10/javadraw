package br.com.douglasoliveira10.javadraw.graph;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Include/exclude globs over binary class names: {@code com.acme.**} matches every type below
 * {@code com.acme}, {@code com.acme.*} matches its direct children and {@code *Dto} any type name
 * ending with {@code Dto}.
 */
public final class TypeFilter {

    private final List<Pattern> includes;
    private final List<Pattern> excludes;

    public TypeFilter(List<String> includes, List<String> excludes) {
        this.includes = includes.stream().map(TypeFilter::compile).toList();
        this.excludes = excludes.stream().map(TypeFilter::compile).toList();
    }

    /** Excluded types are dropped from the model entirely. */
    public boolean isExcluded(String binaryName) {
        return excludes.stream().anyMatch(p -> p.matcher(binaryName).matches());
    }

    /** Project types outside the includes are shown only as external nodes. */
    public boolean isIncluded(String binaryName) {
        return includes.isEmpty() || includes.stream().anyMatch(p -> p.matcher(binaryName).matches());
    }

    static Pattern compile(String glob) {
        StringBuilder regex = new StringBuilder();
        boolean simpleNamePattern = !glob.contains(".");
        if (simpleNamePattern) regex.append("(?:.*\\.)?");
        for (int i = 0; i < glob.length(); i++) {
            char c = glob.charAt(i);
            if (c == '*' && i + 1 < glob.length() && glob.charAt(i + 1) == '*') {
                regex.append(".*");
                i++;
            } else if (c == '*') {
                regex.append("[^.]*");
            } else if (c == '?') {
                regex.append("[^.]");
            } else {
                regex.append(Pattern.quote(String.valueOf(c)));
            }
        }
        return Pattern.compile(regex.toString());
    }
}
