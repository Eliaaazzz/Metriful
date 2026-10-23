package com.fitnessapp.backend.squad.repository;

import com.fitnessapp.backend.squad.entity.SquadMember;
import com.fitnessapp.backend.squad.entity.SquadMemberId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SquadMemberRepository extends JpaRepository<SquadMember, SquadMemberId> {

  List<SquadMember> findAllBySquadId(UUID squadId);

  List<SquadMember> findAllByUserId(UUID userId);

  long countBySquadId(UUID squadId);

  long countByUserId(UUID userId);

  boolean existsBySquadIdAndUserId(UUID squadId, UUID userId);

  void deleteBySquadIdAndUserId(UUID squadId, UUID userId);
}
