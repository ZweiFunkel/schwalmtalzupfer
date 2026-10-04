package de.schwalmtalzupfer.page;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class PublicPageContentTest {
 @Test void removesPrivateNotesAndTranslationsWithoutChangingStoredContent() {
  var event = Map.<String,Object>of("title", "Konzert", "internalNotes", "Private arrival");
  var content = Map.<String,Object>of("termine", List.of(event), "_translations", Map.of("en", Map.of("Private arrival", "Secret translation", "Konzert", "Concert")));
  var clean = PublicPageContent.sanitize(content);
  assertFalse(clean.toString().contains("Private arrival"));
  assertFalse(clean.toString().contains("Secret translation"));
  assertTrue(clean.toString().contains("Concert"));
  assertEquals("Private arrival", event.get("internalNotes"));
 }
}
