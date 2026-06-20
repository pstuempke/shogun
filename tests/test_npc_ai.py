from tests.conftest import make_state, make_npc
from shogun.systems.npc_ai import update_rival_ai, betray
from shogun.core.constants import NpcClass, RIVAL_BEFRIEND_INTERVAL


def _make_rival(zone_id: str = "bridge") -> object:
    npc = make_npc("rival_0", NpcClass.LORD, zone_id)
    npc.rival_candidate = True
    return npc


def test_rival_recruits_willing_npc():
    rival = _make_rival()
    target = make_npc("peasant_0", NpcClass.PEASANT, "bridge")
    # Force target energy low so it's willing (befriend_pct=60 → energy ≤ 60%)
    target.energy = target.max_energy * 0.4
    # Place target within contact range of rival
    rival.position = (400.0, 300.0)
    target.position = (420.0, 300.0)  # 20px apart — within CONTACT_DISTANCE=48

    state = make_state()
    state.npcs["rival_0"] = rival
    state.npcs["peasant_0"] = target
    state.current_zone.npc_ids = ["rival_0", "peasant_0"]
    # elapsed_ticks=0 → 0 % RIVAL_BEFRIEND_INTERVAL == 0 → recruit fires
    state.elapsed_ticks = 0

    update_rival_ai(state)

    assert target.allegiance == "rival_0"
    assert target.is_follower is True
    # rival's followers must NOT appear in player.follower_ids
    assert "peasant_0" not in state.player.follower_ids


def test_rival_skips_player_follower():
    rival = _make_rival()
    follower = make_npc("bandit_0", NpcClass.BANDIT, "bridge")
    follower.allegiance = "player"
    follower.is_follower = True
    follower.energy = 0.0  # fully willing

    rival.position = (400.0, 300.0)
    follower.position = (410.0, 300.0)

    state = make_state()
    state.npcs["rival_0"] = rival
    state.npcs["bandit_0"] = follower
    state.current_zone.npc_ids = ["rival_0", "bandit_0"]
    state.elapsed_ticks = 0

    update_rival_ai(state)

    # allegiance unchanged — rival cannot poach player followers
    assert follower.allegiance == "player"


def test_rival_moves_toward_target_when_out_of_range():
    rival = _make_rival()
    target = make_npc("peasant_0", NpcClass.PEASANT, "bridge")
    target.energy = 0.0

    rival.position = (100.0, 300.0)
    target.position = (600.0, 300.0)   # far away

    state = make_state()
    state.npcs["rival_0"] = rival
    state.npcs["peasant_0"] = target
    state.current_zone.npc_ids = ["rival_0", "peasant_0"]
    state.elapsed_ticks = 0

    original_x = rival.position[0]
    update_rival_ai(state)
    # rival should have moved closer to target (x increased)
    assert rival.position[0] > original_x


def test_rival_inactive_when_recruited_by_player():
    rival = _make_rival()
    rival.allegiance = "player"
    rival.is_follower = True
    target = make_npc("peasant_0", NpcClass.PEASANT, "bridge")
    target.energy = 0.0
    rival.position = (400.0, 300.0)
    target.position = (410.0, 300.0)

    state = make_state()
    state.npcs["rival_0"] = rival
    state.npcs["peasant_0"] = target
    state.current_zone.npc_ids = ["rival_0", "peasant_0"]
    state.elapsed_ticks = 0

    update_rival_ai(state)

    assert target.allegiance is None


def test_betray_removes_follower_and_attacks():
    npc = make_npc("bandit_0", NpcClass.BANDIT, "bridge")
    state = make_state()
    npc.is_follower = True
    npc.allegiance = "player"
    state.npcs["bandit_0"] = npc
    state.player.follower_ids.append("bandit_0")

    betray(state, npc)

    assert npc.is_follower is False
    assert npc.allegiance is None
    assert "bandit_0" not in state.player.follower_ids
    assert npc.combat_target == "player"


def test_betray_logs_event():
    npc = make_npc("bandit_0", NpcClass.BANDIT, "bridge")
    state = make_state()
    npc.is_follower = True
    npc.allegiance = "player"
    state.npcs["bandit_0"] = npc
    state.player.follower_ids.append("bandit_0")

    betray(state, npc)

    assert any("BETRAYED" in entry for entry in state.event_log)
