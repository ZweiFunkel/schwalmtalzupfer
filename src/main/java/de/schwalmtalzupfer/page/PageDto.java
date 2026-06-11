package de.schwalmtalzupfer.page;

import lombok.Builder;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public class PageDto {

    public record PageResponse(UUID id, String slug, String title, boolean published, List<SectionResponse> sections) {}

    @Builder
    public record SectionResponse(UUID id, SectionType type, int position, Map<String, Object> content) {}

    public record UpsertPageRequest(String slug, String title, Boolean published) {}

    public record UpsertSectionRequest(SectionType type, int position, Map<String, Object> content) {}
}

