package com.astralyxpvp;

import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;

public final class XpScriptCommand implements CommandExecutor {

    private final XpActions actions;

    public XpScriptCommand(XpActions actions) {
        this.actions = actions;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command,
                             @NotNull String label, @NotNull String[] args) {
        if (args.length < 2) {
            sender.sendMessage(ChatColor.YELLOW + "Usage: /astralyxxp <xp|givexp> <online-player> [amount]");
            return true;
        }

        String operation = args[0].toLowerCase(java.util.Locale.ROOT);
        Player target = Bukkit.getPlayerExact(args[1]);
        if (target == null) {
            sender.sendMessage(ChatColor.RED + "That player must be online.");
            return true;
        }
        if (operation.equals("xp") || operation.equals("getxp")) {
            if (args.length != 2) {
                sender.sendMessage(ChatColor.YELLOW + "Usage: /astralyxxp xp <online-player>");
                return true;
            }
            actions.queryXp(sender, target);
            return true;
        }
        if (operation.equals("givexp") || operation.equals("addxp")) {
            if (args.length != 3) {
                sender.sendMessage(ChatColor.YELLOW + "Usage: /astralyxxp givexp <online-player> <amount>");
                return true;
            }
            long amount;
            try {
                amount = Long.parseLong(args[2]);
            } catch (NumberFormatException exception) {
                sender.sendMessage(ChatColor.RED + "XP amount must be a whole number.");
                return true;
            }
            actions.giveXp(sender, target, amount);
            return true;
        }

        sender.sendMessage(ChatColor.YELLOW + "Usage: /astralyxxp <xp|givexp> <online-player> [amount]");
        return true;
    }
}
