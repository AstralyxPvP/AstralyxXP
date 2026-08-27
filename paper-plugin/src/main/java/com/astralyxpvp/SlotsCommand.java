package com.astralyxpvp;

import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;

public final class SlotsCommand implements CommandExecutor {

    private final XpActions actions;

    public SlotsCommand(XpActions actions) {
        this.actions = actions;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
        if (!(sender instanceof Player)) {
            sender.sendMessage(ChatColor.RED + "Only players can run this command.");
            return true;
        }
        Player p = (Player) sender;
        if (args.length < 1) {
            p.sendMessage(ChatColor.RED + "Usage: /slots <amount>");
            return true;
        }
        long amount;
        try {
            amount = Long.parseLong(args[0]);
        } catch (NumberFormatException e) {
            p.sendMessage(ChatColor.RED + "Amount must be a number.");
            return true;
        }
        actions.slots(p, amount);
        return true;
    }
}