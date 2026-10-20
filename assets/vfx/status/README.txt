The full pack: Status FX has 16 statuses, each its own design: freeze, bleed, shock, petrify,
plague, soaked, root, slow, chains, curse, marked, shield and regen on top of these three, every
one with its start, loop and end. Same sheets, same player.
https://heyheythere.itch.io/status-fx

sheets/256/    every status at 256x256: sheets/256/<status>/<status>_start.png, _loop.png, _end.png
sheets/128/    the same at half size
sheets/pixel/  pixel-art versions, drawn at 64 px (scale them up with nearest filtering)
previews/      an animated GIF of each sheet
sheets/effects.json  for each sheet: its status ("element") and part ("shape": start, loop or
               end), frame size per set, frame count, columns, fps, whether it loops, the anchor
               (0..1 across and down the frame: the character's feet), "body" (how much of the
               frame's height the character it's drawn round stands, feet on the anchor) and, for
               ten statuses, the "tint" to multiply the character's colour by while it's on

Each sheet is a grid of frames, left to right then top to bottom, 8 to a row, on a transparent
background (straight alpha). Play a status's start once, then its loop for as long as it lasts,
then its end once: the start's last frame runs into the loop's first, and the end's first frame
runs on from the loop's last.

Fitting a character: scale the sheet so that body x frame height = your character's height in
pixels, and put the anchor on its feet.

Godot 4.3+
    Copy addons/status_fx/ into your project and sheets/ into addons/status_fx/, then
        StatusFX.apply($Hero, "burn")              # start, then the loop until removed
        StatusFX.apply($Orc, "freeze", Vector2.ZERO, 150)   # fitted to a character 150 px tall
        StatusFX.remove($Hero, "burn")             # the end, then it frees itself
        StatusFX.clear($Hero)                      # ends every status on it
    It goes on as a child of the character, so it follows it; a status on already isn't doubled.
    Statuses with a tint tint the character's modulate until they end (pass false as the fifth
    argument to leave it). StatusFX.default_set = "pixel" (or "128") switches every apply to that
    set; set StatusFX.sheets_dir if sheets/ is elsewhere. Open addons/status_fx/demo/demo.tscn to
    try them all.

Unity
    Import a sheet, set Texture Type to Sprite (2D and UI), Sprite Mode to Multiple, then in the
    Sprite Editor: Slice > Grid By Cell Size with the frame size from effects.json (256x256 in the
    256 set). Select the sprites in order and drag them into the scene to make the animation; set
    its sample rate to the fps, and chain start > loop > end in an Animator. For the pixel set:
    Filter Mode Point, no compression.

GameMaker
    Create Sprite > Import > the sheet, then Convert to Frames with the frame size, 8 frames per
    row and the frame count from effects.json. Set the sprite's speed to the fps and its origin
    to the anchor; switch sprite_index from start to loop in the Animation End event.

Anything else
    Any engine or framework that cuts a grid sheet: use the frame size and count from
    effects.json.
