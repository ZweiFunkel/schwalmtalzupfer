package de.schwalmtalzupfer.auth;

/** {@code client}: optional, "web" für die Browser-App (dort sind Gast-Konten nicht zugelassen). */
public record LoginRequest(String username, String password, String client) {}
