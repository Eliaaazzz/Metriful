package com.fitnessapp.backend.squad.service;

import static org.mockito.Mockito.*;

import com.fitnessapp.backend.squad.entity.Squad;
import com.fitnessapp.backend.squad.repository.SquadRepository;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SquadStreakSchedulerTest {
  @Test
  void catchesUpMissedCompletedDaysInOrder() {
    SquadRepository repository = mock(SquadRepository.class);
    SquadService service = mock(SquadService.class);
    UUID id = UUID.randomUUID();
    LocalDate yesterday = LocalDate.now(ZoneOffset.UTC).minusDays(1);
    Squad squad = Squad.builder().id(id).timezone("UTC")
        .lastActiveDay(yesterday.minusDays(3)).build();
    when(repository.findAll()).thenReturn(List.of(squad));

    new SquadStreakScheduler(repository, service).evaluateAllSquads();

    var order = inOrder(service);
    order.verify(service).evaluateStreakForDay(id, yesterday.minusDays(2));
    order.verify(service).evaluateStreakForDay(id, yesterday.minusDays(1));
    order.verify(service).evaluateStreakForDay(id, yesterday);
    order.verifyNoMoreInteractions();
  }

  @Test
  void skipsSquadAlreadyEvaluatedThroughYesterday() {
    SquadRepository repository = mock(SquadRepository.class);
    SquadService service = mock(SquadService.class);
    Squad squad = Squad.builder().id(UUID.randomUUID()).timezone("UTC")
        .lastActiveDay(LocalDate.now(ZoneOffset.UTC).minusDays(1)).build();
    when(repository.findAll()).thenReturn(List.of(squad));

    new SquadStreakScheduler(repository, service).evaluateAllSquads();

    verifyNoInteractions(service);
  }
}
