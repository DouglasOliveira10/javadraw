package br.com.douglasoliveira10.javadraw.asm;

import org.objectweb.asm.Handle;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.Type;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.FieldInsnNode;
import org.objectweb.asm.tree.InvokeDynamicInsnNode;
import org.objectweb.asm.tree.LdcInsnNode;
import org.objectweb.asm.tree.LineNumberNode;
import org.objectweb.asm.tree.LocalVariableNode;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.MultiANewArrayInsnNode;
import org.objectweb.asm.tree.TryCatchBlockNode;
import org.objectweb.asm.tree.TypeInsnNode;
import org.objectweb.asm.tree.VarInsnNode;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Extracts calls, lambdas and referenced types from a method body.
 */
public final class MethodBodies {

    private static final String LAMBDA_METAFACTORY = "java/lang/invoke/LambdaMetafactory";
    private static final String OBJECT_METHODS = "java/lang/runtime/ObjectMethods";

    /** A call instruction as written in bytecode, before hierarchy resolution. */
    public record RawCall(String owner, String name, String descriptor, int opcode, boolean methodReference,
                          int line) {
    }

    /**
     * @param calls   method invocations and method references
     * @param lambdas synthetic lambda body methods of the same class created by this method
     * @param types   internal names of every class referenced by the body
     * @param recordObjectMethod body delegates to {@code ObjectMethods}, as compiler generated record methods do
     */
    public record Body(List<RawCall> calls, List<String> lambdas, Set<String> types, boolean recordObjectMethod) {
    }

    private MethodBodies() {
    }

    public static Body scan(ClassNode owner, MethodNode method) {
        List<RawCall> calls = new ArrayList<>();
        List<String> lambdas = new ArrayList<>();
        Set<String> types = new LinkedHashSet<>();
        int line = 0;
        boolean recordObjectMethod = false;

        for (AbstractInsnNode insn : method.instructions) {
            switch (insn) {
                case LineNumberNode ln -> line = ln.line;
                case MethodInsnNode call -> {
                    calls.add(new RawCall(call.owner, call.name, call.desc, call.getOpcode(), false, line));
                    addType(types, call.owner);
                }
                case InvokeDynamicInsnNode indy -> {
                    if (OBJECT_METHODS.equals(indy.bsm.getOwner())) recordObjectMethod = true;
                    if (LAMBDA_METAFACTORY.equals(indy.bsm.getOwner()) && indy.bsmArgs.length > 1
                            && indy.bsmArgs[1] instanceof Handle impl) {
                        if (impl.getOwner().equals(owner.name) && isLambdaBody(owner, impl)) {
                            lambdas.add(impl.getName() + impl.getDesc());
                        } else {
                            calls.add(new RawCall(impl.getOwner(), impl.getName(), impl.getDesc(),
                                    opcodeOf(impl.getTag()), true, line));
                            addType(types, impl.getOwner());
                        }
                    }
                }
                case TypeInsnNode typeInsn -> addType(types, typeInsn.desc);
                case FieldInsnNode field -> {
                    addType(types, field.owner);
                    addDescriptor(types, field.desc);
                }
                case LdcInsnNode ldc when ldc.cst instanceof Type type -> addDescriptor(types, type.getDescriptor());
                case MultiANewArrayInsnNode array -> addDescriptor(types, array.desc);
                default -> {
                }
            }
        }
        if (method.tryCatchBlocks != null) {
            for (TryCatchBlockNode block : method.tryCatchBlocks) {
                if (block.type != null) addType(types, block.type);
            }
        }
        if (method.localVariables != null) {
            for (LocalVariableNode local : method.localVariables) {
                addDescriptor(types, local.desc);
            }
        }
        return new Body(calls, lambdas, types, recordObjectMethod);
    }

    public static boolean isLambdaBody(ClassNode owner, Handle handle) {
        if (!handle.getName().startsWith("lambda$")) return false;
        return owner.methods.stream().anyMatch(m -> m.name.equals(handle.getName()) && m.desc.equals(handle.getDesc())
                && (m.access & Opcodes.ACC_SYNTHETIC) != 0);
    }

    /** First source line of a method, or 0 when compiled without debug information. */
    public static int firstLine(MethodNode method) {
        for (AbstractInsnNode insn : method.instructions) {
            if (insn instanceof LineNumberNode ln) return ln.line;
        }
        return 0;
    }

    /** A trivial getter ({@code return this.x}) or setter ({@code this.x = arg}, optionally fluent). */
    public static boolean isAccessor(ClassNode owner, MethodNode method) {
        if ((method.access & (Opcodes.ACC_STATIC | Opcodes.ACC_ABSTRACT)) != 0 || method.name.startsWith("<")) {
            return false;
        }
        List<AbstractInsnNode> code = new ArrayList<>();
        for (AbstractInsnNode insn : method.instructions) {
            if (insn.getOpcode() >= 0) code.add(insn);
        }
        int args = Type.getArgumentTypes(method.desc).length;
        if (args == 0 && code.size() == 3) {
            return isLoadThis(code.get(0))
                    && code.get(1) instanceof FieldInsnNode f && f.getOpcode() == Opcodes.GETFIELD && f.owner.equals(owner.name)
                    && isReturn(code.get(2)) && code.get(2).getOpcode() != Opcodes.RETURN;
        }
        if (args == 1 && (code.size() == 4 || code.size() == 5)) {
            boolean assigns = isLoadThis(code.get(0))
                    && code.get(1) instanceof VarInsnNode arg && arg.var == 1
                    && code.get(2) instanceof FieldInsnNode f && f.getOpcode() == Opcodes.PUTFIELD && f.owner.equals(owner.name);
            if (!assigns) return false;
            return code.size() == 4
                    ? code.get(3).getOpcode() == Opcodes.RETURN
                    : isLoadThis(code.get(3)) && code.get(4).getOpcode() == Opcodes.ARETURN;
        }
        return false;
    }

    private static boolean isLoadThis(AbstractInsnNode insn) {
        return insn instanceof VarInsnNode v && v.getOpcode() == Opcodes.ALOAD && v.var == 0;
    }

    private static boolean isReturn(AbstractInsnNode insn) {
        return insn.getOpcode() >= Opcodes.IRETURN && insn.getOpcode() <= Opcodes.RETURN;
    }

    private static int opcodeOf(int handleTag) {
        return switch (handleTag) {
            case Opcodes.H_INVOKESTATIC -> Opcodes.INVOKESTATIC;
            case Opcodes.H_INVOKEINTERFACE -> Opcodes.INVOKEINTERFACE;
            case Opcodes.H_INVOKESPECIAL, Opcodes.H_NEWINVOKESPECIAL -> Opcodes.INVOKESPECIAL;
            default -> Opcodes.INVOKEVIRTUAL;
        };
    }

    /** Accepts an internal name or an array descriptor (as used by ANEWARRAY/CHECKCAST). */
    private static void addType(Set<String> types, String internalNameOrArray) {
        if (internalNameOrArray.startsWith("[")) addDescriptor(types, internalNameOrArray);
        else types.add(internalNameOrArray);
    }

    private static void addDescriptor(Set<String> types, String descriptor) {
        Type type = Type.getType(descriptor);
        while (type.getSort() == Type.ARRAY) type = type.getElementType();
        if (type.getSort() == Type.OBJECT) types.add(type.getInternalName());
    }
}
