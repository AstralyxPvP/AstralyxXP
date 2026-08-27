package com.astralyxpvp;

import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;

public final class CoinflipCommand implements CommandExecutor {

    private final XpActions actions;

    public CoinflipCommand(XpActions actions) {
        this.actions = actions;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
        if (!(sender instanceof Player)) {
            sender.sendMessage(org.bukkit.ChatColor.RED + "Only players can run this command.");
            return true;
        }
        Player p = (Player) sender;
        if (args.length < 2) {
            p.sendMessage(org.bukkit.ChatColor.RED + "Usage: /coinflip <heads|tails> <amount>");
            return true;
        }
        long amount;
        try {
            amount = Long.parseLong(args[1]);
        } catch (NumberFormatException e) {
            p.sendMessage(org.bukkit.ChatColor.RED + "Amount must be a number.");
            return true;
        }
        actions.coinflip(p, args[0], amount);
        return true;
    }
}