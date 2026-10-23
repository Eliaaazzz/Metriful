package com.fitnessapp.backend.squad.repository;

import com.fitnessapp.backend.squad.entity.Squad;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SquadRepository extends JpaRepository<Squad, UUID> {

  Optional<Squad> findByInviteCode(String inviteCode);

  boolean existsByInviteCode(String inviteCode);

  @Query("""
      SELECT s FROM Squad s
       WHERE s.id IN (
             SELECT m.squadId FROM SquadMember m WHERE m.userId = :userId
       )
       ORDER BY s.createdAt DESC NULLS LAST
      """)
  List<Squad> findAllForMember(@Param("userId") UUID userId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("SELECT s FROM Squad s WHERE s.id = :id")
  Optional<Squad> findByIdForUpdate(@Param("id") UUID id);
}
