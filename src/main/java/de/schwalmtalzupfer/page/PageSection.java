package de.schwalmtalzupfer.page;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "page_section")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PageSection {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "page_id", nullable = false)
    private Page page;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SectionType type;

    @Column(nullable = false)
    private int position;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> content;
}

