package de.schwalmtalzupfer.member;

public enum MemberRole {
    GUEST,
    MEMBER,
    BOARD,
    /** Führt den Unterricht durch - exklusiv zuständig für Beitrittsanträge, Mitgliederverwaltung
     *  sowie Gitarrengruppen/Unterricht/Preise (fachlich sein Bereich). */
    CHEF,
    ADMIN
}
