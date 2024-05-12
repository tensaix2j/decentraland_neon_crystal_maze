import { 
    Vector3,
    Quaternion,
    Color3,
    Color4 } from "@dcl/sdk/math";


import {
    engine,
    Transform,
    GltfContainer,
    inputSystem,
    PointerEvents,
    InputAction,
    PointerEventType,
    Material,
    MeshRenderer,
    MeshCollider,
    AvatarShape,
    TextureWrapMode,
    Animator,
    Billboard
} from '@dcl/sdk/ecs'




import resources from "./resources"

import { SokobanGenerator } from "./sokoban_generator";

// Static levels
import tutorial from "./levels/tutorial"
import cclp1_02 from "./levels/cclp1_02"
import cclp1_03 from "./levels/cclp1_03"
import cclp1_04 from "./levels/cclp1_04"
import cclp1_05 from "./levels/cclp1_05"
import cclp1_06 from "./levels/cclp1_06"
import cclp1_07 from "./levels/cclp1_07"
import cclp1_08 from "./levels/cclp1_08"
import cclp1_09 from "./levels/cclp1_09"
import cclp1_10 from "./levels/cclp1_10"
import cc1_02 from "./levels/cc1_02"
import cc1_03 from "./levels/cc1_03"
import cc1_04 from "./levels/cc1_04"
import cc1_05 from "./levels/cc1_05"
import cc1_07 from "./levels/cc1_07"
import cc1_08 from "./levels/cc1_08"
import cc1_09 from "./levels/cc1_09"
import cc1_10 from "./levels/cc1_10"
import cc1_11 from "./levels/cc1_11"
import sokoban_01 from "./levels/sokoban_01";
import lobby from "./levels/lobby";

import debug from "./levels/debug02"

interface Layer {
    data: any[];
    name: string;
}

//-------------------
export class Stage {

    public root;
    public tile_size = 1.000;
    public entities = [];
    public current_level_obj:any = null;


    public player;
    public player_pos = Vector3.create(0,0,0);
    public player_stats:any[] = []; 
    
    
    public static_tiles:any = [];
    public pickables = {};
    public removables = {};
    public movables = {};
    public creatables = {};
    public monsters = {};
    public togglables = {};
    public sokoban_holes = {};
    

    public src_and_target = {};
    public teleports:any[] = [];
    public explosions:any[] = [];
    public directions = {};
    public hints = {};
    public exits = {};

    
    
    public current_level_obj_index = {};
    public game_state = 0;
    public standard_wall_color  = Color4.fromInts(   6, 19, 94, 255 );
    public standard_floor_color = Color4.fromInts(  39, 32, 30, 255 );
    public standard_dirt_color  = Color4.fromInts( 100, 80, 40, 255 );

    public ice_sliding_speed    = 0.33;
    public force_floor_sliding_speed = 0.31;


    public levels = [ 

        lobby,      // lobby

        tutorial,   // intro to keys,water,ice,fire,force
        cc1_02,     // intro to block
        cclp1_04,   // block practice
        sokoban_01, // basic sokoban level
        
        cc1_03,     // intro to boots
        cclp1_02,   // boots practice
        cclp1_03,   // boots practice
        cc1_04,     // intro to blue,green switches
        
        cclp1_08,   // blue,green switches practice
        cc1_05,     // intro to red, yellow switches
        cclp1_07,   // red, yellow switches practice 
        cclp1_05,    // intro to hidden walls

        cc1_08,     //  intro to dirt,gravel
        cclp1_06,   //  bugs, gravel, dirt practce
        cc1_07,      // intro to theif and teleport
        cclp1_09,    // theif and teleport practice

        cclp1_10,    // graduation 
        cc1_09,      // everyone in one
        cc1_10,      // maze with fire
        cc1_11,      // maze with 3 lanes

    ]

    public level_index = 0;
 







    //-----------------
    constructor( aPos )  {

        let root = engine.addEntity();
        Transform.create( root, {
            position: aPos 
        });
        this.root = root;
        this.create_player();
        this.load_level( this.levels[ this.level_index ].layers );


        engine.addSystem( this.update );
        

    }


    //--------
    open_lock_if_bump_into_one( tilecoord:number ) {
        
        if ( this.removables[ tilecoord ] != null ) {
            
            let tile    = this.removables[ tilecoord ][0];
            let item_id = this.removables[ tilecoord ][1];

            // 2-5 padlock bumped
            if ( item_id >= 2 && item_id <= 5 ) {

                let inventory_id = item_id - 2;

                // has key.
                if ( resources["ui"]["inventory"]["items"][inventory_id].count > 0 ) {
                    
                    resources["index"].play_sound("switch");
                    engine.removeEntity( tile );
                    delete this.removables[ tilecoord ];
                    
                    // Deplete inventory
                    resources["ui"]["inventory"]["items"][inventory_id].count -= 1;
                    if ( resources["ui"]["inventory"]["items"][ inventory_id ].count <= 1 ) {
                        resources["ui"]["inventory"]["items"][ inventory_id ].count_lbl = ""  ;
                        if ( resources["ui"]["inventory"]["items"][ inventory_id ].count <= 0 ) {
                            resources["ui"]["inventory"]["items"][ inventory_id ].visible = "none"  ;
                        }
                    }
                    
                    
                } else {
                    resources["index"].play_sound("denied");
                }

            // 6 crystal wall bumped
            } else if ( item_id == 6 ) {
                if ( resources["ui"]["gamestatus"].chip_remaining <= 0 ) {

                    resources["index"].play_sound("success");
                    engine.removeEntity( tile );
                    delete this.removables[ tilecoord ];
                    
                } else {
                    resources["index"].play_sound("denied");
                } 
            
            // 21 sokoban wall bumped
            } else if ( item_id == 21 ) {
                
                // For sokoban wall, we check all holes are they plugged.
                let all_holes_plugged = 1;
                for ( let hole_tilecoord in this.sokoban_holes ) {
                    if ( this.movables[ hole_tilecoord ] && this.movables[ hole_tilecoord ][1] == 7 ) {
                    } else {
                        
                        all_holes_plugged = 0;
                        break;
                    }
                }

                if ( all_holes_plugged == 1 ) {
                    resources["index"].play_sound("success");
                    engine.removeEntity( tile );
                    delete this.removables[ tilecoord ];
                    
                } else {
                    resources["index"].play_sound("denied");
                }

            // 9 - 10: hidden wall bumped
            } else if ( item_id == 9 ) {

                this.change_uv_face( tile, 1, 13 , 16, 16) ;


            } else if ( item_id == 10 ) {
                engine.removeEntity( tile );
                delete this.removables[ tilecoord ];
                resources["index"].play_sound("buttonshort");
            }
        }
    }




    //----------------
    pickup_items() {

        let tilecoord = ( this.player_pos.z * 32 + this.player_pos.x ) ;

        if ( this.pickables[ tilecoord   ] != null ) {
            // Pick up item if land on one.
            let ent     = this.pickables[ tilecoord  ][0];
            let item_id = this.pickables[ tilecoord  ][1];
            
            engine.removeEntity( ent );
            delete this.pickables[ tilecoord  ] ;
            
            if ( item_id >= 66 && item_id <= 73 ) {

                let inventory_id = item_id - 66;
                resources["ui"]["inventory"]["items"][ inventory_id ].count += 1;
                resources["ui"]["inventory"]["items"][ inventory_id ].visible = "flex";
                if ( resources["ui"]["inventory"]["items"][ inventory_id ].count > 1 ) {
                    resources["ui"]["inventory"]["items"][ inventory_id ].count_lbl = resources["ui"]["inventory"]["items"][ inventory_id ].count + ""  ;
                }

                resources["index"].play_sound( "hit" );
            
            } else if ( item_id == 65 ) {
                
                resources["ui"]["gamestatus"].chip_remaining -= 1;
                resources["index"].play_sound( "crystal" );
                
            }
        }
    }


    

    //---
    get_new_tilecoord_on_ice(  tilecoord:number , direction:number, tile_data_bg:number , func_tile_passable ) {
        
        let new_tilecoord = tilecoord;  

        if ( tile_data_bg == 43 ) {
            new_tilecoord = tilecoord + direction;
            // Check if new tile actually passable, if not then bounce back.
            if ( func_tile_passable( new_tilecoord, direction ) == false  ) {
                new_tilecoord = tilecoord - direction;
            }
        
        } else if ( tile_data_bg == 44 ) {
            
            if ( direction == -1 ) {
                new_tilecoord = tilecoord + 32;
                if ( func_tile_passable( new_tilecoord, 32 ) == false  ) {
                    new_tilecoord = tilecoord + 1;
                }
            } else if ( direction == -32 ) {
                new_tilecoord = tilecoord + 1;
                if ( func_tile_passable( new_tilecoord, 1 ) == false  ) {
                    new_tilecoord = tilecoord + 32;
                }
            }



        } else if ( tile_data_bg == 45 ) {
            
            if ( direction == 1 ) {
                new_tilecoord = tilecoord + 32;
                if ( func_tile_passable( new_tilecoord, 32 ) == false  ) {
                    new_tilecoord = tilecoord - 1;
                }
            } else if ( direction == -32 ) {
                new_tilecoord = tilecoord - 1;
                if ( func_tile_passable( new_tilecoord, -1 ) == false  ) {
                    new_tilecoord = tilecoord + 32;
                }
            }
        } else if ( tile_data_bg == 46 ) {
            
            if ( direction == -1 ) {
                new_tilecoord = tilecoord - 32;
                if ( func_tile_passable( new_tilecoord, -32 ) == false  ) {
                    new_tilecoord = tilecoord + 1;
                }
            } else if ( direction == 32 ) {

                new_tilecoord = tilecoord + 1;
                if ( func_tile_passable( new_tilecoord, 1 ) == false  ) {

                    new_tilecoord = tilecoord - 32;
                }
            }

        } else if ( tile_data_bg == 47 ) {
            
            if ( direction == 1 ) {
                new_tilecoord = tilecoord - 32;
                if ( func_tile_passable( new_tilecoord, -32 ) == false  ) {
                    new_tilecoord = tilecoord - 1;
                }
            } else if ( direction == 32 ) {
                new_tilecoord = tilecoord - 1;
                if ( func_tile_passable( new_tilecoord, -1 ) == false  ) {
                    new_tilecoord = tilecoord - 32;
                }
            }
        } 
        return new_tilecoord;
    }






    //--------
    // CPCT
    check_player_current_tile(  prev_tilecoord:number ) {
        
        let tilecoord       = this.player_pos.z * 32 + this.player_pos.x ;
        let tile_data_bg    = this.current_level_obj[ this.current_level_obj_index["bg"] ].data[ tilecoord ];
        let tile_data_item  = this.current_level_obj[ this.current_level_obj_index["item"] ].data[ tilecoord ];

        // 37: Water.
        if ( this.removables[ tilecoord ] && this.removables[ tilecoord ][1] == 37 && this.removables[tilecoord][5] == null ) {
            
            let inventory_id = 4; 
            // has water boot
            if ( resources["ui"]["inventory"]["items"][inventory_id].count > 0 ) {
                // survive
            } else {
        
                // Water trap
                resources["index"].play_sound("water");
                this.gameover("Dropped into water without flippers");

                // Position player to seem like dropped into water.
                Transform.getMutable(this.player).position.y = -0.2;
                Transform.getMutable(this.player).position.x = (  this.player_pos.x - 15 ) * this.tile_size ;
                Transform.getMutable(this.player).position.z = ( -this.player_pos.z + 15 ) * this.tile_size ;
                
            }
        }


        // 38: Fire
        if ( this.removables[ tilecoord ] && this.removables[ tilecoord ][1] == 38  ) {

            let inventory_id = 5; 
            // has fire boot
            if ( resources["ui"]["inventory"]["items"][inventory_id].count > 0 ) {
                // survive
            } else {
                resources["index"].play_sound("fire");
                this.gameover("Killed by fire");
            }
        }


        // 99: Bomb
        if ( this.removables[ tilecoord ] && this.removables[ tilecoord ][1] == 99  ) {
            
            engine.removeEntity( this.removables[ tilecoord ][0] );
            delete this.removables[ tilecoord ];
            
            this.create_explosions_on_tile( tilecoord );
            this.gameover("Killed by a bomb");
            
            
        }


            


        // 39-42 Force floor
        
        // 39: left , 40: up , 41: right  , 42: down
        if ( tile_data_bg >= 39 && tile_data_bg <= 42  ) {

            let inventory_id = 6;
            // has force floor boot
            if ( resources["ui"]["inventory"]["items"][inventory_id].count > 0 ) {
                // survive
            } else {

                // CPCT STEP ON FORCE FLOOR
                
                let direction     = [-1,-32,1,32][ tile_data_bg - 39 ];
                let new_tilecoord = tilecoord + direction;
                
                if ( this.check_is_tile_passable( new_tilecoord, direction ) == true  ) {
                    // for consistency with monster,  2: progress, 6:direction, 7: new_tilecoord
                    this.player_stats[2] = 0;
                    this.player_stats[3] = this.tilecoord_to_position( tilecoord );
                    this.player_stats[4] = this.tilecoord_to_position( new_tilecoord );
                    this.player_stats[6] = direction 
                    this.player_stats[7] = new_tilecoord;
                    this.player_stats[8] = this.force_floor_sliding_speed;  //speed
                    this.player_stats[10] = null;
                }

                
            }
        }
        
        // 43-47 Ice Floor
        // 43: center , 44: corners DR, 45: DL, 46: UR,  47: UL
        if ( tile_data_bg >= 43 && tile_data_bg <= 47 ) {

            let inventory_id = 7;
            // has skate boot
            if ( resources["ui"]["inventory"]["items"][inventory_id].count > 0 ) {
                // survive

            } else {       

                
                let direction = tilecoord - prev_tilecoord;
                let new_tilecoord = this.get_new_tilecoord_on_ice(  tilecoord, direction, tile_data_bg , this.check_is_tile_passable.bind(this) );
                let new_direction = new_tilecoord - tilecoord;

                
                this.player_stats[2] = 0;
                this.player_stats[3] = this.tilecoord_to_position( tilecoord );
                this.player_stats[4] = this.tilecoord_to_position( new_tilecoord );
                this.player_stats[6] = new_direction; 
                this.player_stats[7] = new_tilecoord;
                this.player_stats[8] = this.ice_sliding_speed;  
                this.player_stats[10] = null;
                
                
            }
        }

        

        // 48,49,80,81,82 Tile buttons
        if ( [48,49,80,81,82].indexOf( tile_data_item ) > -1 ) {
            this.tile_button_on_pressed( tilecoord , tile_data_item ) ;
        }

        // 84: Teleport 
        if ( tile_data_item == 84 ) {
            
            
            let curindex    = this.teleports.indexOf( tilecoord );
            let targetIndex = ( curindex + this.teleports.length - 1 ) % this.teleports.length;
            let target_tilecoord = this.teleports[ targetIndex ];
            
            
            if ( target_tilecoord ) {
                
                this.player_pos.x = target_tilecoord % 32;
                this.player_pos.z = (target_tilecoord / 32) >> 0;
                
                this.player_align_avatar_to_player_pos_tilecoord();
                resources["index"].play_sound("teleport");
            }
        }

        // 129: Thief
        if ( tile_data_item == 129 ) {

            for ( let inventory_id = 4 ; inventory_id < 8 ; inventory_id++ ) {
                // Deplete inventory
                resources["ui"]["inventory"]["items"][inventory_id].count = 0;
                resources["ui"]["inventory"]["items"][ inventory_id ].count_lbl = ""  ;
                resources["ui"]["inventory"]["items"][ inventory_id ].visible = "none"  ;

                resources["index"].play_sound( "oof" );
            }
        }

        // 53 : recessed wall
        if ( tile_data_item == 53  ) {

            let x_tile = tilecoord % 32;
            let z_tile = (tilecoord / 32 ) >> 0; 
            
            // Create wall
            let tile = this.create_textured_block_emissive(
                (x_tile - 15 ) * this.tile_size,
                1, 
                (-z_tile + 15 ) * this.tile_size, 

                'images/tileset_64.png',
                1,
                13,
                16,
                16,
                
                1,
                0.5,
                0.9 
           );

            this.creatables[ tilecoord ] = [ tile , 1 ];
            resources["index"].play_sound( "stone" );
        }

        // 11 Dirt on stepped
        if ( this.creatables[ tilecoord ] && this.creatables[ tilecoord ][1] == 11 ) {

            this.creatables[ tilecoord ][1] = 33;
            this.change_uv_face( this.creatables[ tilecoord ][0], 3,13,16,16);
            
        }

        // 34 Exit
        if ( tile_data_bg == 34 ) {
            this.victory( tilecoord );

        }

        // 52 Trap on entered
        if ( tile_data_item == 52 ) {

            if ( this.is_trap_active( tilecoord ) == true ) {
                this.player_stats[9] = 1;
                resources["index"].play_sound( "oof" );
            }
        }   

        // 36 Hint 
        if ( this.hints[ tilecoord ] ) {
            resources["ui"]["hint"].visible = "flex";
            resources["ui"]["hint"].text = this.text_adjust( this.hints[ tilecoord ] , 85 );
            resources["index"].play_sound( "buttonclick" );
            
        } else {
            resources["ui"]["hint"].visible = "none";

        }
    }


    //-----
    text_adjust( txt:string , wrapwidth:number ) {
        
        let marks:any[] = [];
        let cnt = 0;
        for ( let i = 0 ; i < txt.length ; i++) {
            if ( cnt >= wrapwidth ) {
                if ( [". ", ",", " ", "，", "。", "、" ].indexOf( txt[i] ) > -1  ) {      
                    marks.push(i);
                    cnt = 0;
                } else if ( txt[i] == "\n" ) {
                    cnt = 0;
                }
            }
            cnt++;
        }
        for ( let i = marks.length - 1 ; i >= 0 ; i-- ) {
            txt = txt.substring(0, marks[i]) + "\n" + txt.substring( marks[i] + 1);
        }
        return txt;

    }

    //-------
    is_trap_active( tilecoord:number ) {

        for ( let key in this.src_and_target ) {

            let src_tilecoord = parseInt( key );
            if ( this.src_and_target[ src_tilecoord ] == tilecoord ) {
                
                // Movable block is still pressing.. so the trap is in deactivated state.
                if ( this.movables[ src_tilecoord ] ) {
                    return false;
                }
                // Player is pressing
                if ( this.player_pos.z * 32 + this.player_pos.x == src_tilecoord ) {
                    return false;
                }

                // Monster is pressing 
                if ( this.monsters[ src_tilecoord ] ) {
                    return false;
                }
            }
        }
        return true;
    }

    //----
    // CBCT
    check_movable_block_current_tile( tilecoord:number , prev_tilecoord:number ) {


        if ( this.movables[ tilecoord ] ) {

            let tile_data_bg    = this.current_level_obj[ this.current_level_obj_index["bg"] ].data[ tilecoord ];
            let tile_data_item  = this.current_level_obj[ this.current_level_obj_index["item"] ].data[ tilecoord ];

            
            let movable = this.movables[ tilecoord ];

            // if movable block lands on Player. Player Die
            if ( this.player_pos.z * 32 + this.player_pos.x == tilecoord ) {
                this.gameover("Killed by a moving rock");
            }

            // 37: If movable block lands on water
            if ( this.removables[ tilecoord ] && this.removables[ tilecoord ][1] == 37  ) {

                // Create dirt
                resources["index"].play_sound("water");
                this.create_dirt( tilecoord , 11 );
                
                // remove water 
                engine.removeEntity( this.removables[tilecoord ][0] );
                delete this.removables[ tilecoord ];

                // Remove movable block after dirt creation
                engine.removeEntity( movable[0] );
                delete this.movables[ tilecoord ];
                
            }


            // Movable block vs bomb
            // 99: Bomb
            if ( this.removables[ tilecoord ] && this.removables[ tilecoord ][1] == 99  ) {
                
                //resources["index"].play_sound("explosion");
                this.create_explosions_on_tile( tilecoord );
                
                // Diffuse bomb
                engine.removeEntity( this.removables[ tilecoord ][0] );
                delete this.removables[ tilecoord ];

                engine.removeEntity(  this.movables[ tilecoord ][0 ] );
                delete this.movables[ tilecoord ];
            }


            // If movable block lands on force floor
            if ( tile_data_bg >= 39 && tile_data_bg <= 42 ) {

                // CPCT STEP ON FORCE FLOOR
                
                let direction     = [-1,-32,1,32][ tile_data_bg - 39 ];
                let new_tilecoord = tilecoord + direction;
                
                if ( this.check_is_tile_passable_for_movable_block( new_tilecoord, direction ) == true  ) {
                    
                    let new_direction = new_tilecoord - tilecoord;
                    movable[2] = 0;
                    movable[3] = this.tilecoord_to_position( tilecoord );
                    movable[3].y = 1;
                    movable[4] = this.tilecoord_to_position( new_tilecoord );
                    movable[4].y = 1;
                    movable[6] = new_direction; 
                    movable[7] = tilecoord; //save old
                    movable[8] = this.force_floor_sliding_speed;  //speed
                    movable[10] = null;

                    delete this.movables[ tilecoord ];
                    this.movables[ new_tilecoord ] =  movable ;
                }

            }


            // If movable block lands on ice then it will slide.
            if ( tile_data_bg >= 43 && tile_data_bg <= 47 ) {

                let direction = tilecoord - prev_tilecoord;
                let new_tilecoord = this.get_new_tilecoord_on_ice(  tilecoord, direction, tile_data_bg , this.check_is_tile_passable_for_movable_block.bind(this) );
                let new_direction = new_tilecoord - tilecoord;

                movable[2] = 0;
                movable[3] = this.tilecoord_to_position( tilecoord );
                movable[3].y = 1;
                movable[4] = this.tilecoord_to_position( new_tilecoord );
                movable[4].y = 1;
                movable[6] = new_direction; 
                movable[7] = tilecoord; //save old
                movable[8] = this.ice_sliding_speed;  //speed
                movable[10] = null;

                delete this.movables[ tilecoord ];
                this.movables[ new_tilecoord ] =  movable ;
                
            }

             // 48,49,80,81,82 Tile buttons
             if ( [48,49,80,81,82].indexOf( tile_data_item) > -1 ) {
                this.tile_button_on_pressed( tilecoord , tile_data_item );
            }
        }
        
    }


    //--------
    // CMCT
    check_monster_current_tile(  tilecoord:number ) {
        

        if ( this.monsters[ tilecoord ] ) {

            let tile_data_item  = this.current_level_obj[ this.current_level_obj_index["item"] ].data[ tilecoord ];

            // 52 trap
            if ( tile_data_item == 52 ) {
                if ( this.is_trap_active( tilecoord ) == true ) {
                    this.monsters[ tilecoord ][9] = 1;
                }
            }

            // 99 bomb
            if ( this.removables[ tilecoord ] && this.removables[ tilecoord ][1] == 99 ) {
                
                // Both bomb and monster die
                let tile = this.removables[ tilecoord ][0];
                engine.removeEntity( tile );
                delete this.removables[ tilecoord ];

                let monster = this.monsters[ tilecoord ][0];
                engine.removeEntity( monster );
                delete this.monsters[ tilecoord ];

                //resources["index"].play_sound("explosion");
                this.create_explosions_on_tile( tilecoord );
            }


            // Water. All monsters except glider(100) shd die when touch water
            if ( this.removables[ tilecoord ] && this.removables[ tilecoord ][1] == 37  ) {

                if ( this.monsters[ tilecoord ][1] != 100 ) {
                    let monster = this.monsters[ tilecoord ][0];
                    engine.removeEntity( monster );
                    delete this.monsters[ tilecoord ];
                }
            }

            // 48,49,80,81 Tile buttons
            if ( [48,49,80,81,82].indexOf( tile_data_item) > -1 ) {
                this.tile_button_on_pressed( tilecoord , tile_data_item );
            }
            
        }
    }   

    //----------------------
    // Can be called by player, monster or movable block
    tile_button_on_pressed( tilecoord:number , tile_data_item:number ) {

        console.log("tile_button_on_pressed", tilecoord );

        resources["index"].play_sound("buttonshort");
        
        // 80: Red button
        if ( tile_data_item == 80 ) {
            if ( this.src_and_target[ tilecoord ] ) {
                let target_tilecoord         = this.src_and_target[ tilecoord ];
                let target_tile_data_item   = this.current_level_obj[ this.current_level_obj_index["item"] ].data[ target_tilecoord ];

                // activate clone 
                if ( target_tile_data_item == 8 && this.monsters[ target_tilecoord ] ) {
                    this.clone_monster( 
                        target_tilecoord, 
                        this.monsters[ target_tilecoord ][1], 
                        this.monsters[ target_tilecoord ][6]  
                    );
                }
            }
        }

        // 48: Blue button,
        if ( tile_data_item == 48 ) {
            for ( let tilecoord in this.monsters ) {
                if ( this.monsters[tilecoord] && this.monsters[tilecoord][1] == 98 ) {
                    this.monsters[ tilecoord ][6] = -this.monsters[ tilecoord ][6];
                }
            }
        }

        // 49: Green button
        if ( tile_data_item == 49 ) {
            
            for ( let tilecoord in this.togglables ) {

                // Make sure it is 50-51: togglable walls
                if ( this.togglables[ tilecoord ][1] >= 50 && this.togglables[ tilecoord ][1] <= 51 ) {

                    this.togglables[ tilecoord ][2] = 1 - this.togglables[ tilecoord ][2];
                    let tile = this.togglables[ tilecoord ][0] ;
                    if ( this.togglables[ tilecoord ][2] == 0 ) {
                        Transform.getMutable(tile).position.y = -2;
                    } else {
                        Transform.getMutable(tile).position.y = 1;
                    }
                }
            }
        }

        // 81: Yellow button 
        if ( tile_data_item == 81 ) {

            if ( this.src_and_target[ tilecoord ] ) {
                let target_tilecoord         = this.src_and_target[ tilecoord ];
                let target_tile_data_item   = this.current_level_obj[ this.current_level_obj_index["item"] ].data[ target_tilecoord ];

                // Release trap which has monster
                if ( target_tile_data_item == 52 && this.monsters[ target_tilecoord ] && this.monsters[ target_tilecoord][9] == 1 ) {
                    
                    this.monsters[ target_tilecoord][9] = null;
                    this.monsters_next_move( target_tilecoord );
                }

                if ( target_tile_data_item == 52 && this.player_stats[9] == 1 ) {
                    this.player_stats[9] = null;
                }
            }
                
        }

        //82 Grey button
        if ( tile_data_item == 82 ) {
            
        }
        
    }


    //------
    clone_monster( tilecoord:number , type:number, direction:number ) {

        
        if ( this.check_is_tile_passable_for_monster( tilecoord + direction, type , direction ) == true  ) {
            
            console.log( "Cloned" + " " + tilecoord );
            this.create_monster( tilecoord + direction, type , direction);

        } else {
            console.log("space occupied");
        }
    }

    //--------
    create_dirt( tilecoord:number , type:number ) {

        if ( this.creatables[ tilecoord ] == null ) {

            let x_tile  = tilecoord % 32;
            let z_tile  = (tilecoord / 32 ) >> 0;

            let tile = this.create_textured_block( 
                (x_tile - 15 ) * this.tile_size,
                0, 
                (-z_tile + 15 ) * this.tile_size, 

                'images/tileset_64.png',
                4,
                13,
                16,
                16,

                type,
                1,
                1,
            );
            this.creatables[ tilecoord ] = [ tile , type  ];
        }
    }



    //---------
    create_monster( tilecoord:number, type:number , direction:number ) {

        let static_glbs = [ 97 , 98, 100, 101 , 102,  103, 104, 105, 106 ];
        let static_glbs_index = static_glbs.indexOf( type ) 
                        
        if ( static_glbs_index > -1  ) {

            let x_tile  = tilecoord % 32;
            let z_tile  = (tilecoord / 32 ) >> 0;
            let size    = [ 0.5, 0.9 , 0.9 , 1 , 0.7 ,    0.9, 0.5, 0.7, 0.7 ][ static_glbs_index ]
            let y       = [ 0.6, 0.7, 1.2 , 0.6, 0.6,    0.6, 0.6, 0.6, 0.6 ][ static_glbs_index ]
            
            if ( this.monsters[ tilecoord ] == null ) {

                let tile = this.create_glb_block( 
                    (x_tile - 15 ) * this.tile_size,
                    y, 
                    (-z_tile + 15 ) * this.tile_size,
                    type,
                    size,
                    size
                );
                    
                if ( direction != null ) {
                    Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees( 0 , this.get_y_rot_by_direction(direction), 0 );
                }
                
                //                                        progrss start end  isdead  
                this.monsters[ tilecoord ] = [ tile, type, null, null, null, null, direction ];
                this.check_monster_current_tile(  tilecoord );
                this.monsters_next_move( tilecoord ); 
            
            }
        }
        
    }



    //-------------
    // GENERAL PASSABLE 
    check_is_tile_passable_general( tilecoord:number , direction:number ) {

        let ret = true; 
        // standard wall (1) 
        if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord  ] == 1  )  {
            ret = false;
        

            
        // lockpad (2-5) and crystal door(6)
        } else if ( this.removables[ tilecoord  ] && 
             this.removables[ tilecoord ][1] >= 2 && this.removables[ tilecoord ][1] <= 6  )  {
            ret = false;
            
        // sokoban door
        } else if ( this.removables[ tilecoord ] && this.removables[ tilecoord ][1] == 21 ) {
            
            ret = false;

        // togglable wall
        } else if ( this.togglables[ tilecoord  ] && 
            this.togglables[ tilecoord ][1] >= 50 && this.togglables[ tilecoord ][1] <= 51 &&
            this.togglables[ tilecoord ][2] == 1  )  {

           ret = false;
        

        // recessed wall
        } else if ( this.creatables[ tilecoord ] && this.creatables[ tilecoord ][1] == 1 ) {
            ret = false
        

        // Clone machine 
        } else if ( this.current_level_obj[  this.current_level_obj_index["item"] ].data[  tilecoord  ] == 8  )  {
            ret = false;
        

        // Blue wall
        } else if ( this.removables[ tilecoord  ] && 
            this.removables[ tilecoord ][1] >= 9 && this.removables[ tilecoord ][1] <= 10  )  {
            ret = false;
        

        // Ice corner 
        } else if ( this.current_level_obj[  this.current_level_obj_index["bg"] ].data[  tilecoord  ] == 44 ) {
            if ( direction == 1 || direction == 32 ) {
                ret = false;
            }
        } else if ( this.current_level_obj[  this.current_level_obj_index["bg"] ].data[  tilecoord  ] == 45 ) {
            if ( direction == -1 || direction == 32 ) {
                ret = false;
            }
        } else if ( this.current_level_obj[  this.current_level_obj_index["bg"] ].data[  tilecoord  ] == 46 ) {
            if ( direction == 1 || direction == -32 ) {
                ret = false;
            }
        } else if ( this.current_level_obj[  this.current_level_obj_index["bg"] ].data[  tilecoord  ] == 47 ) {
            if ( direction == -1 || direction == -32 ) {
                ret = false;
            }


        // From ice corner to other tile also need to consider.
        // So we check from other tile's perspective
        } else if ( this.current_level_obj[  this.current_level_obj_index["bg"] ].data[  tilecoord - direction  ] == 44 ) {
            if ( direction == -1 || direction == -32 ) {

                ret = false;
            }
        } else if ( this.current_level_obj[  this.current_level_obj_index["bg"] ].data[  tilecoord - direction  ] == 45 ) {
            if ( direction ==  1 || direction == -32 ) {

                ret = false;
            }
        } else if ( this.current_level_obj[  this.current_level_obj_index["bg"] ].data[  tilecoord - direction ] == 46 ) {
            if ( direction == -1 || direction == 32 ) {
                ret = false;
            }
        } else if ( this.current_level_obj[  this.current_level_obj_index["bg"] ].data[  tilecoord - direction ] == 47 ) {
            if ( direction == 1 || direction == 32 ) {

                ret = false;
            }


        // thin wall 
        } else if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord  ] == 13  )  {
            if ( direction == 1 ) {
                ret = false;
            }   
        
        } else if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord  ] == 14  )  {
            if ( direction == 32 ) {
                ret = false;
            }   
        } else if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord  ] == 15  )  {
            if ( direction == -1 ) {
                ret = false;
            }   
        } else if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord  ] == 16  )  {
            if ( direction == -32 ) {
                ret = false;
            }  

        } else if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord  ] == 17 ) {
            if ( direction == 1 || direction == 32 ) {
                ret = false;
            }
        } else if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord  ] == 18 ) {
            if ( direction == -1 || direction == 32 ) {
                ret = false;
            }
        } else if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord  ] == 19 ) {
            if ( direction == 1 || direction == -32 ) {
                ret = false;
            }
        } else if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord  ] == 20 ) {
            if ( direction == -1 || direction == -32 ) {
                ret = false;
            }



        // From thin wall to other
        } else if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord - direction  ] == 13  )  {
            if ( direction == -1 ) {
                ret = false;
            }   
        
        } else if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord - direction  ] == 14  )  {
            if ( direction == -32 ) {
                ret = false;
            }   
        } else if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord - direction  ] == 15  )  {
            if ( direction == 1 ) {
                ret = false;
            }   
        } else if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord - direction  ] == 16  )  {
            if ( direction == 32 ) {
                ret = false;
            }  

        } else if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord - direction  ] == 17 ) {
            if ( direction == -1 || direction == -32 ) {
                ret = false;
            }
        } else if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord - direction  ] == 18 ) {
            if ( direction == 1 || direction == -32 ) {
                ret = false;
            }
        } else if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord - direction  ] == 19 ) {
            if ( direction == -1 || direction == 32 ) {
                ret = false;
            }
        } else if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord - direction  ] == 20 ) {
            if ( direction == 1 || direction == 32 ) {
                ret = false;
            }
       
        }


        return ret;

    }


    //-------
    // CHECK PLAYER PASSABLE
    check_is_tile_passable( tilecoord:number , direction:number ) {

        let ret = true;
        
        // player is trapped
        if ( this.player_stats[9] == 1 ) {
            return false;
        }

        // Generic check
        if ( this.check_is_tile_passable_general( tilecoord , direction ) == false ) {

            ret = false;
        
        
        // Movable blocks (7), if there's a movable block, check if pushable or not.
        } else if ( this.movables[ tilecoord ] ) {
            
            if ( this.check_is_tile_passable_for_movable_block( tilecoord + direction , direction  ) == true ) {
               
            } else {
                // Cannot push into
                ret = false;
            }
        
        }
        
        return ret;

    }


    //----
    // CHECK BLOCK PASSABLE
    check_is_tile_passable_for_movable_block( tilecoord:number ,  direction:number ) {

        let ret = true;
        
        if ( this.check_is_tile_passable_general( tilecoord , direction ) == false ) {
            ret = false;

        // Movable blocks
        } else if ( this.movables[ tilecoord ] ) {
            ret = false;

        // Dirt
        } else if ( this.creatables[ tilecoord ] && 
            this.creatables[ tilecoord ][1] == 11) {
            ret = false;
        }

        return ret;
    }

    //-------
    // CHECK MONSTER PASSABLE
    check_is_tile_passable_for_monster( tilecoord:number , monster_type:number , direction:number ) {

        let ret = true;
        
        let tile_data_bg    = this.current_level_obj[ this.current_level_obj_index["bg"] ].data[ tilecoord ];
        let tile_data_item  = this.current_level_obj[ this.current_level_obj_index["item"] ].data[ tilecoord ];

        if ( this.check_is_tile_passable_general( tilecoord, direction ) == false ) {

            ret = false;

        } else if ( this.creatables[ tilecoord ] && this.creatables[ tilecoord ][1] == 11 ) {
            
            
            ret = false;
        
        } else if ( tile_data_bg == 12 ) {
            
            ret = false;


        } else if ( this.monsters[ tilecoord ] ) {
            
            ret = false;
            
        } else if ( this.pickables[ tilecoord ] ) {

            ret = false;

        // recessed wall
        } else if ( tile_data_item == 53 ) {

            ret = false
        
        // Movable blocks (7), 
        } else if ( this.movables[ tilecoord ] ) {
            ret = false;
        

        // For Fire. All monsters except fireball(101) treat it as wall
        } else if ( this.removables[ tilecoord ] && this.removables[tilecoord ][1] == 38 ) {
            
            if ( monster_type != 101 ) {
                ret = false;
            }
        
        }
        
        return ret;
    }





    //----
    // PMB
    push_movable_block(  direction:number ) {
        
        let tilecoord       =  this.player_pos.z * 32 + this.player_pos.x ;
        let tile_data_bg    = this.current_level_obj[ this.current_level_obj_index["bg"] ].data[ tilecoord ];
        
        if ( this.movables[ tilecoord ] && this.movables[tilecoord][5] == null )  {    

            let movable = this.movables[ tilecoord ];
            
            let new_tilecoord = tilecoord + direction;
            
            // If the block on push is on corner ice, then the direction will take a 90 degree sharp turn
            if ( tile_data_bg >= 44 && tile_data_bg <= 47 ) {
                new_tilecoord = this.get_new_tilecoord_on_ice(  tilecoord, direction, tile_data_bg ,  this.check_is_tile_passable_for_movable_block.bind(this) );
            }
            let new_direction = new_tilecoord - tilecoord;
            
            movable[1] = 7;
            movable[2] = 0;
            movable[3] = this.tilecoord_to_position( tilecoord );
            movable[3].y = 1;
            movable[4] = this.tilecoord_to_position( new_tilecoord );
            movable[4].y = 1;
            movable[6] = new_direction; 
            movable[7] = tilecoord; // save the old tilecoord
            movable[8] = 0.16;  //speed
            movable[10] = null;
            
            
            // Should occupy the new tile immediately but dont do block_current_tile() yet until lerp finished.
            delete this.movables[ tilecoord ];
            this.movables[ new_tilecoord ] =  movable ;
            
        }
    }

    

    //-----
    get_y_rot_by_direction( direction:number ) {
        
        if ( direction == -1 ) {
            return -90;
        } else if ( direction == -32 ) {
            return 0;
        } else if ( direction == 1 ) {
            return 90
        } else if ( direction == 32 ) {
            return 180
        }
        return 0;
    }

    //--------
    move_player(  direction:number ) {

        if ( this.game_state != 0 ) {
            return;
        }

        // player's involuntary movement.
        if ( this.player_stats[2] != null ) {
            return;
        }

        let cur_tilecoord   = ( this.player_pos.z * 32 + this.player_pos.x );
        let new_tilecoord   = ( this.player_pos.z * 32 + this.player_pos.x ) + direction;


        if ( this.check_is_tile_passable( new_tilecoord , direction ) == true ) {
            
            this.player_stats[2] = 0;
            this.player_stats[3] = this.tilecoord_to_position( cur_tilecoord );
            this.player_stats[4] = this.tilecoord_to_position( new_tilecoord );
            this.player_stats[6] = direction;
            this.player_stats[7] = new_tilecoord;
            this.player_stats[8] = 0.135; //speed

            
        } else {
            this.open_lock_if_bump_into_one( new_tilecoord );
        }
        
        
    }

    

    //---------
    create_player() {

        let player = engine.addEntity();
        Transform.create( player, {
            
            parent: this.root,
            
            position: Vector3.create(
                Transform.getMutable( this.root ).position.x ,
                Transform.getMutable( this.root ).position.y ,
                Transform.getMutable( this.root ).position.z,
            ),
            scale: Vector3.create( 
                0.65 , 0.65 , 0.65
            )
            
        })
        GltfContainer.create( player, {
            src: 'models/player.glb',
        });
        Animator.create(player, {
            states: [
              {
                clip: 'idle',
                playing: true,
                loop: true,
              },
              {
                clip: 'walk',
                playing: false,
                loop: true
              }
            ],
        })

        this.player = player;
    }





    //----
    // GLB creation
    create_glb_block(  x, y, z , tile_type, height, size ) {

        let tile = engine.addEntity();
        Transform.create( tile , {
            parent: this.root,
            position: { 
                x: x,  
                y: y, 
                z: z
            },
            scale: {
                x: size,  y: height, z: size
            }
        });

        let src = 'models/block_bright_edge.glb';

        if ( tile_type == 37 ) {
            src = 'models/block_water.glb';
         
        } else if ( tile_type == 43 ) {
            
            src = 'models/block_ice.glb';
             
        } else if ( tile_type == 44 ) {
            
            src = 'models/block_ice_corner.glb';
            Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees(0, 0, 0 );
            
        } else if ( tile_type == 45 ) {

            src = 'models/block_ice_corner.glb';
            Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees(0, 90, 0 );
            
        } else if ( tile_type == 46 ) {

            src = 'models/block_ice_corner.glb';
            Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees(0, 270, 0 );
            
        } else if ( tile_type == 47 ) {

            src = 'models/block_ice_corner.glb';
            Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees(0, 180, 0 );
            

        } else if ( tile_type == 7 ) {
            src = 'models/block_bright_edge3.glb';
        } else if ( tile_type == 38 ) {
            src = 'models/campfire.glb';

        } else if ( tile_type == 48 ) {
            src = 'models/bluebutton.glb';
        } else if ( tile_type == 49 ) {
            src = 'models/greenbutton.glb';
        } else if ( tile_type == 80 ) {
            src = 'models/redbutton.glb';
        
        } else if ( tile_type == 81 ) {
            src = 'models/yellowbutton.glb';
        
        } else if ( tile_type == 82 ) {
            src = 'models/greybutton.glb';


        } else if ( tile_type == 84 ) {
            src = 'models/teleport.glb';
        } else if ( tile_type == 52 ) {
            src = 'models/trap.glb';
        } else if ( tile_type == 129 ) {
            src = 'models/thief.glb';
        } else if ( tile_type == 99 ) {
            src = 'models/bomb.glb';
        } else if ( tile_type == 97 ) {
            src = 'models/spider.glb';
            Animator.create(tile, {
                states: [
                  {
                    clip: 'walk',
                    playing: true,
                    loop: true
                  }
                ],
            })
            Animator.playSingleAnimation( tile , 'walk', false )
        } else if ( tile_type == 98 ) {
            src = 'models/tank.glb';
        } else if ( tile_type == 100 ) {
            src = 'models/glider.glb';
        } else if ( tile_type == 101 ) {
            src = 'models/fireball.glb';
        
        } else if ( tile_type == 102 ) {
            src = 'models/pinkball.glb';
        

        } else if ( tile_type == 103 ) {
            src = 'models/pacman.glb';
        } else if ( tile_type == 104 ) {
            src = 'models/spider2.glb';

            Animator.create(tile, {
                states: [
                  {
                    clip: 'walk',
                    playing: true,
                    loop: true
                  }
                ],
            })
        } else if ( tile_type == 105 ) {
            src = 'models/eyeball.glb';
        } else if ( tile_type == 106 ) {
            src = 'models/walker.glb';
        


        } else if ( tile_type == 70 ) {
            src = 'models/boot_flipper.glb'

        } else if ( tile_type == 71 ) {
            src = 'models/boot_fire.glb'
        } else if ( tile_type == 72 ) {
            src = 'models/boot_suction.glb'
        } else if ( tile_type == 73 ) {
            src = 'models/boot_skates.glb'
        
        } else if ( tile_type == 13 ) {
            src = 'models/thin_wall.glb';
            Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees(0, 0, 0 );
        } else if ( tile_type == 14 ) {
            src = 'models/thin_wall.glb';
            Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees(0, 90, 0 );
        } else if ( tile_type == 15 ) {
            src = 'models/thin_wall.glb';
            Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees(0, 180, 0 );
        
        } else if ( tile_type == 16 ) {
            src = 'models/thin_wall.glb';
            Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees(0, 270, 0 );


        } else if ( tile_type == 17 ) {
            src = 'models/thin_wall_corner.glb';
            Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees(0, 0, 0 );
        } else if ( tile_type == 18 ) {
            src = 'models/thin_wall_corner.glb';
            Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees(0, 90, 0 );
        } else if ( tile_type == 19 ) {
            src = 'models/thin_wall_corner.glb';
            Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees(0, 270, 0 );
        } else if ( tile_type == 20 ) {
            src = 'models/thin_wall_corner.glb';
            Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees(0, 180, 0 );
        
        }

        
        
        GltfContainer.create(tile, {
            src: src,
        })
        return tile;
        
    }


    //------
    create_colored_block( x, y, z , color , height, size) {

        let tile = engine.addEntity();
        Transform.create( tile , {
            parent: this.root,
            position: { 
                x: x,  
                y: y, 
                z: z
            },
            scale: {
                x: size,  y: height, z: size
            }
        });
        MeshRenderer.setBox(tile);
        Material.setBasicMaterial(tile, {
            diffuseColor: color
        })
        return tile;
    }


    
    //------
    create_colored_block_reflective( x, y, z , color , height, size , metallic, roughness) {

        let tile = engine.addEntity();
        Transform.create( tile , {
            parent: this.root,
            position: { 
                x: x,  
                y: y, 
                z: z
            },
            scale: {
                x: size,  y: height, z: size
            }
        });
        MeshRenderer.setBox(tile);
        Material.setPbrMaterial(tile, {
            albedoColor: color,
            metallic: 0,
            roughness: 1,
        })
        return tile;
    }


    

    //------
    create_textured_block( 
        x, y, z , 
        src, frame_x, frame_y, x_frames, y_frames, 
        type,
        height, size ) {

        let tile = engine.addEntity();
        Transform.create( tile , {
            parent: this.root,
            position: { 
                x: x,  
                y: y, 
                z: z
            },
            scale: {
                x: size,  y: height, z: size
            }
        });

        this.change_uv_face( tile, frame_x, frame_y, x_frames, y_frames);

        Material.setBasicMaterial( tile , {
            texture: Material.Texture.Common({
                src: src ,
            }),
            
        })
        return tile;
    }


    //--------------------
    change_textured_block_emissive_intensity( tile , intensity ) {

        let color = Color3.fromInts( 255,255,255 );

        Material.setPbrMaterial( tile , {
            texture: Material.Texture.Common({
                src: 'images/tileset_64.png',
            }),
            emissiveTexture: Material.Texture.Common({
                src: 'images/tileset_64.png' ,
            }),
            emissiveColor: color,
            emissiveIntensity: intensity,
        })
    }



    //----
    change_uv_face( tile, frame_x, frame_y, x_frames, y_frames) {

        MeshRenderer.setBox(tile, [
            
            // T
            (frame_x )/x_frames             , (frame_y+1) / y_frames,
            (frame_x + 1)/x_frames        , (frame_y+1) / y_frames,
            (frame_x + 1 )/x_frames     , frame_y / y_frames,
            (frame_x )/x_frames             , frame_y / y_frames,
            
            (frame_x )/x_frames             , frame_y / y_frames,
            (frame_x + 1 )/x_frames     , frame_y / y_frames,
            (frame_x + 1)/x_frames        , (frame_y+1) / y_frames,
            (frame_x )/x_frames             , (frame_y+1) / y_frames,
            
            // L
            (frame_x )/x_frames             , (frame_y+1) / y_frames,
            (frame_x + 1)/x_frames        , (frame_y+1) / y_frames,
            (frame_x + 1 )/x_frames     , frame_y / y_frames,
            (frame_x )/x_frames             , frame_y / y_frames,
            
            // R
            (frame_x + 1)/x_frames        , (frame_y+1) / y_frames,
            (frame_x )/x_frames             , (frame_y+1) / y_frames,
            (frame_x )/x_frames             , frame_y / y_frames,
            (frame_x + 1 )/x_frames     , frame_y / y_frames,
            
            (frame_x + 1 )/x_frames     , frame_y / y_frames,
            (frame_x + 1)/x_frames        , (frame_y+1) / y_frames,
            (frame_x )/x_frames             , (frame_y+1) / y_frames,
            (frame_x )/x_frames             , frame_y / y_frames,
            
            // F
            (frame_x )/x_frames             , (frame_y+1) / y_frames,
            (frame_x + 1)/x_frames        , (frame_y+1) / y_frames,
            (frame_x + 1 )/x_frames     , frame_y / y_frames,
            (frame_x )/x_frames             , frame_y / y_frames,
            
        ]);
    }

    //------
    create_textured_block_emissive( 
        
        x, y, z , 
        src, frame_x, frame_y, x_frames, y_frames, 
        type,
        height, size ) {

        let tile = engine.addEntity();
        Transform.create( tile , {
            parent: this.root,
            position: { 
                x: x,  
                y: y, 
                z: z
            },
            scale: {
                x: size,  y: height, z: size
            }
        });

        this.change_uv_face( tile, frame_x, frame_y, x_frames, y_frames) ;

        let color = Color3.fromInts(255,255,255);
        let emissiveIntensity = 10;

        if ( type == 2 ) {
            color = Color3.fromInts( 0, 255, 0 );

        } else if ( type == 3 ) {
            color = Color3.fromInts( 0, 0, 255 );
            
        } else if ( type == 4 ) {
            color = Color3.fromInts( 255, 0, 0 );

        } else if ( type == 5 ) {
            color = Color3.fromInts( 255, 255, 0 );
        } else if ( type == 34 ) {
            color = Color3.fromInts( 0, 255, 0 );
        

        } else if ( type == 50 || type == 51 ) {
            color = Color3.fromInts( 0, 255, 0 );
            emissiveIntensity = 5; 

        } else if ( type == 53 ) {
            color = Color3.fromInts( 155, 0, 155 );
            emissiveIntensity = 8; 
    


        } else if ( type >= 39 && type <= 42 ) {
            
            color = Color3.fromInts( 0, 255, 0 );
            Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees(0, [-90,0,90,180][ type - 39] ,0);
            

        } else if ( type >= 9 && type <= 10 ) {

            color = Color3.fromInts( 255,255,255 );
            emissiveIntensity = 1; 
    
        } else if ( type == 1 ) {

            color = Color3.fromInts( 255,87,51 );
            emissiveIntensity = 10; 
        
        } else if ( type == 36 ) {
            
            color = Color3.fromInts( 100,0,255 );
            emissiveIntensity = 10; 
        
        }   



        Material.setPbrMaterial( tile , {
            texture: Material.Texture.Common({
                src: src ,
            }),
            emissiveTexture: Material.Texture.Common({
                src: src ,
            }),
            emissiveColor: color,
            emissiveIntensity: emissiveIntensity,
            
        })
        return tile;
    }


    //----------
    debug() {

       //console.log( "monsters", this.monsters );
       //console.log( "src_and_target", this.src_and_target );
        //console.log( "sokoban_holes", this.sokoban_holes );
        //console.log( "movables" , this.movables );
        //console.log( "exits", this.exits );
        
    }


    //------
    create_explosions_on_tile( tilecoord:number ) {
        
        let x_tile = tilecoord % 32;
        let z_tile = (tilecoord / 32) >> 0;
        let x = ( x_tile - 15 ) * this.tile_size ;
        let z = (-z_tile + 15) * this.tile_size ;
        let y = 1;
        this.create_explosions( x,y,z, 1 );

    }

    //--------
    create_explosions( x,y,z , size ) {

        
        let tile = engine.addEntity();
        Transform.create( tile, {
            parent: this.root,
            position: {
                x: x,  
                y: y, 
                z: z
            },
            scale: {
                x: size,  y: size, z: size
            }
        });
        
        
        let frame_x = 2;
        let frame_y = 3;
        let x_frames = 5;
        let y_frames = 4;
        
        Material.setPbrMaterial( tile , {
            texture: Material.Texture.Common({
                src: 'images/explosion.png' ,
            }),
            emissiveTexture: Material.Texture.Common({
                src: 'images/explosion.png' ,
            }),
            alphaTexture: Material.Texture.Common({
                src: 'images/explosion.png' ,
            }),
            emissiveColor: Color3.fromInts(255,172,28),
            emissiveIntensity: 20,            
        })
        
        MeshRenderer.setPlane(tile, [
            
            // T
            (frame_x )/x_frames               , frame_y / y_frames,
            (frame_x )/x_frames               , (frame_y+1) / y_frames,
            (frame_x + 1)/x_frames            , (frame_y+1) / y_frames,
            (frame_x + 1 )/x_frames           , frame_y / y_frames,
            
            // B
            (frame_x )/x_frames               , frame_y / y_frames,
            (frame_x )/x_frames               , (frame_y+1) / y_frames,
            (frame_x + 1)/x_frames            , (frame_y+1) / y_frames,
            (frame_x + 1 )/x_frames           , frame_y / y_frames,
            
        ]);

        Billboard.create( tile );
        resources["index"].play_sound("explosion");
        
        this.explosions.push( [ tile, 101, 0 ] );
        return tile

    }







    //------
    create_item_plane_emissive( x, y, z , src, frame_x, frame_y, type, size ) {

        let tile = engine.addEntity();
        Transform.create( tile , {
            parent: this.root,
            position: { 
                x: x,  
                y: y, 
                z: z
            },
            scale: {
                x: size,  y: size, z: size
            }
        });
        Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees( 45, 0 , 0 );
        
        let x_frames = 16;
        let y_frames = 16;

        MeshRenderer.setPlane(tile, [
            
            // T
            (frame_x )/x_frames               , frame_y / y_frames,
            (frame_x )/x_frames               , (frame_y+1) / y_frames,
            (frame_x + 1)/x_frames            , (frame_y+1) / y_frames,
            (frame_x + 1 )/x_frames           , frame_y / y_frames,
            
            // B
            (frame_x )/x_frames               , frame_y / y_frames,
            (frame_x )/x_frames               , (frame_y+1) / y_frames,
            (frame_x + 1)/x_frames            , (frame_y+1) / y_frames,
            (frame_x + 1 )/x_frames           , frame_y / y_frames,
            
        ]);
        
        let color = Color3.fromInts(255,255,255);
        if ( type == 66 ) {
            color = Color3.fromInts( 0, 255, 0 );

        } else if ( type == 67 ) {
            color = Color3.fromInts( 0, 0, 255 );
            
        } else if ( type == 68 ) {
            color = Color3.fromInts( 255, 0, 0 );

        } else if ( type == 69 ) {
            color = Color3.fromInts( 255, 255, 0 );
        } 

        Material.setPbrMaterial( tile , {
            texture: Material.Texture.Common({
                src: src ,
            }),
            emissiveTexture: Material.Texture.Common({
                src: src ,
            }),
            alphaTexture: Material.Texture.Common({
                src: src ,
            }),
            emissiveColor: color,
            emissiveIntensity: 10,
            
        })
        return tile
    }


    //---------
    player_align_avatar_to_player_pos_tilecoord() {

        Transform.getMutable( this.player ).position.x = (  this.player_pos.x - 15 ) * this.tile_size  ;
        Transform.getMutable( this.player ).position.z = ( -this.player_pos.z + 15 ) * this.tile_size  ;
        Transform.getMutable( this.player ).position.y = 0.5;

    }

    //-------------
    tilecoord_to_position( tilecoord ):Vector3 {

        let tile_x = tilecoord % 32;
        let tile_z = ( tilecoord / 32 ) >> 0;
        let x = (  tile_x - 15 ) * this.tile_size  ;
        let z = ( -tile_z + 15 ) * this.tile_size  ;
        let y =  0.5;

        return Vector3.create( x, y, z );
        
    }

    //----
    back_to_lobby() {

        this.clear_dynamic_objects();
        this.clear_static_objects();
        this.clear_inventory();
        this.level_index = 0;
        this.load_level( this.levels[ this.level_index ].layers );
        resources["ui"]["notification"].text = ""
        this.game_state = 0;
    }



    //-----
    // E on pressed
    next_level() {

        if ( this.game_state == 3 ) {

            resources["ui"]["notification"].text = "Please wait a while... Generating level..."

            this.clear_static_objects();
            this.clear_inventory();
            
            if ( this.player_stats[11] == null ) {
                this.level_index = this.level_index + 1 ;
            } else {
 
                // Custom level
                this.level_index = this.player_stats[11];
                this.player_stats[11] = null;
            }

            // Static levels
            if ( this.level_index < this.levels.length ) {
                this.load_level( this.levels[ this.level_index ].layers );
            
            // Procedural generated levels
            } else {
                this.load_level( this.generate_sokoban() );
            }

            resources["ui"]["notification"].text = ""
            this.game_state = 0;
               
        }
    }


    
    //----------
    generate_sokoban() {

        let layers:Layer[] = [
            {
                "data":[],
                "name":"bg"
            },
            {
                "data":[],
                "name":"fg"
            },
            {
                "data":[],
                "name":"removable"
            },
            {
                "data":[],
                "name":"item"
            },
        ]
        
        let sokoban 

        let sizes       = [ 8,8,9,9, 10, 10 , 11,11, 12,12,13,13,14,14,15,15,16,16,17,17,18,18 ];
        let numBoxes    = [ 2,3,3,4,  4,  4,   5, 5,  5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9,10,10 ];
        let size        =  sizes[ this.level_index - this.levels.length ];
        let num_of_box  =  numBoxes[ this.level_index - this.levels.length ];
        
        for ( let i = 0 ; i < 5 ; i++ ) {
            sokoban = new SokobanGenerator( size , size , num_of_box );
            if ( sokoban.trash == false ) {
                break;
            }
        }

        for ( let i = 0 ; i < sokoban.nodes.length ; i++ ) {

            for ( let j = 0 ; j < sokoban.nodes[i].length ; j++ ) {
                
                let tile_x = j + 3;
                let tile_z = i + 3;
 
                if ( sokoban.boxMap[j+","+i] ) {
                    layers[2].data[ tile_z * 32 + tile_x ] = 7;
                }
                if (  sokoban.buttonMap[j+","+i] ) {
                    layers[3].data[ tile_z * 32 + tile_x ] = 82;
                }
                if ( sokoban.nodes[j][i].wall == true ) {

                    if ( sokoban.doorMap[j+","+i] == 1 ) {
                        layers[2].data[ tile_z * 32 + tile_x ] = 21;  
                        layers[0].data[ tile_z * 32 + tile_x ] = 33;  
                        layers[0].data[ (tile_z - 1) * 32 + tile_x ] = 34;  
                        

                    } else if ( sokoban.doorMap[j+","+i] == 2 ) {
                        layers[2].data[ tile_z * 32 + tile_x ] = 21;
                        layers[0].data[ tile_z * 32 + tile_x ] = 33;  
                        layers[0].data[ (tile_z + 1) * 32 + (tile_x  ) ] = 34;    
                        
                    } else if ( sokoban.doorMap[j+","+i] == 3 ) {
                        layers[2].data[ tile_z * 32 + tile_x ] = 21; 
                        layers[0].data[ tile_z * 32 + tile_x ] = 33;  
                        layers[0].data[ (tile_z ) * 32 + (tile_x - 1 ) ] = 34;     
                        
                    } else if ( sokoban.doorMap[j+","+i] == 4 ) {
                        layers[2].data[ tile_z * 32 + tile_x ] = 21; 
                        layers[0].data[ tile_z * 32 + tile_x ] = 33;  
                        layers[0].data[ (tile_z) * 32 + (tile_x + 1 ) ] = 34;     
                        
                    } else if ( sokoban.surrounded(j,i) == false  ) {
                        layers[1].data[ tile_z * 32 + tile_x ] = 1;  
                    } 
                } else {
                    layers[0].data[ tile_z * 32 + tile_x ] = 33;  
                }

                if ( sokoban.playerX == j && sokoban.playerY == i ) {
                    layers[3].data[ tile_z * 32 + tile_x ] = 35;
                }
                // Incase of leaking wall
                if ( sokoban.nodes[j][i].wall == false ) {
                    if ( i == 0 ) {
                        layers[1].data[ (tile_z - 1 ) * 32 + tile_x ] = 1; 
                    }
                    if ( i == sokoban.ySize - 1 ) {
                        layers[1].data[ (tile_z + 1 ) * 32 + tile_x ] = 1; 
                    }
                    if ( j == 0 ) {
                        layers[1].data[ (tile_z ) * 32 + (tile_x - 1) ] = 1; 
                    }
                    if ( j == sokoban.xSize - 1 ) {
                        layers[1].data[ (tile_z ) * 32 + (tile_x + 1) ] = 1; 
                    }
                }
            }

        }
        return layers;
    }





    //-----
    victory( v_tilecoord:number ) {

        for ( let i = this.static_tiles.length - 1 ; i >= 0 ; i-- ) {
            
            let tilecoord = this.static_tiles[i][3] ;
            let tile = this.static_tiles[i][0] ;
            if ( tilecoord != v_tilecoord ) {
                
                engine.removeEntity( tile );
                this.static_tiles.splice( i , 1 );
            } 
        }

        if ( this.exits[ v_tilecoord ] ) {
            resources["index"].play_sound("teleport");
            resources["ui"]["notification"].text = "Press (E) to proceed."
            this.player_stats[11] = this.exits[ v_tilecoord ];
        } else {
            resources["index"].play_sound("victory");
            resources["ui"]["notification"].text = "Congratulations. Press (E) to proceed to next level"
        }

        this.clear_dynamic_objects();
        this.game_state = 3;

        if ( this.level_index <= 20 ) {
            resources["index"].submit_highscore( this.level_index, 0 ); 
        } else {
            resources["index"].submit_highscore( this.level_index, 1 ); 
        }
    }

    //-------
    // GO: GAME OVER
    gameover( die_message ) {

        resources["index"].play_sound( "scream" );
        resources["ui"]["bgmask"].visible = "flex";
        resources["ui"]["notification"].text = "GAME OVER! \n\n" + die_message + "\n\nPress (1) To Restart.";
        
        this.game_state = 2;
        Animator.playSingleAnimation( this.player , 'idle', false )

    }


    //---
    clear_static_objects() {
        for ( let i = this.static_tiles.length - 1 ; i >= 0 ; i-- ) {
            let tile = this.static_tiles[i][0];
            engine.removeEntity( tile );
            this.static_tiles.splice( i , 1 );
        }
    }


    //---
    clear_dynamic_objects() {

        for ( let tilecoord in this.pickables ) {
            let tile = this.pickables[tilecoord][0];
            engine.removeEntity( tile );
            delete this.pickables[tilecoord];
        } 
        for ( let tilecoord in this.removables ) {
            let tile = this.removables[tilecoord][0];
            engine.removeEntity( tile );
            delete this.removables[tilecoord];
        }
        for ( let tilecoord in this.movables ) {
            let tile = this.movables[tilecoord][0];
            engine.removeEntity( tile );
            delete this.movables[tilecoord];
        }
        
        for ( let tilecoord in this.creatables ) {
            let tile = this.creatables[tilecoord][0];
            engine.removeEntity( tile );
            delete this.creatables[tilecoord];
        }
        for ( let tilecoord in this.monsters ) {
            let tile = this.monsters[tilecoord][0];
            engine.removeEntity( tile );
            delete this.monsters[tilecoord];
        }
        
        for ( let tilecoord in this.togglables ) {
            let tile = this.togglables[tilecoord][0];
            engine.removeEntity( tile );
            delete this.togglables[tilecoord];
        }       
        for ( let src in this.src_and_target ) {
            delete this.src_and_target[src];
        }
        for ( let tilecoord in this.directions ) {
            delete this.directions[ tilecoord ] ;
        }
        for ( let tilecoord in this.hints ) {
            delete this.hints[ tilecoord ] ;
        }
        for ( let tilecoord in this.sokoban_holes ) {
            delete this.sokoban_holes[ tilecoord ];
        }
        for ( let tilecoord in this.exits ) {
            delete this.exits[ tilecoord ];
        }

        this.teleports.length = 0;

    }



    
    //---
    clear_inventory() {
        for ( let i = 0 ; i < 8 ; i++ ) {
            resources["ui"]["inventory"]["items"][i].visible = "none";
            resources["ui"]["inventory"]["items"][i].count_lbl   = "";
            resources["ui"]["inventory"]["items"][i].count      = 0;
        }
    }

    //---
    restart_level() {

        if ( this.game_state == 3 ) {
            return ;
        }

        this.game_state = 0;    
        resources["ui"]["bgmask"].visible = "none";
        resources["ui"]["notification"].text = "";

        this.clear_inventory();

        
        // Dirt
        for ( let tilecoord in this.creatables ) {
            engine.removeEntity( this.creatables[tilecoord][0] );
            delete this.creatables[tilecoord];
        }

        // Movable blocks
        for ( let tilecoord in this.movables ) {
            if ( this.current_level_obj[ this.current_level_obj_index["fg"] ].data[ tilecoord ] == 7 ) {
                this.movables[tilecoord][5] = null;
            } else {
                let tile = this.movables[tilecoord][0];
                engine.removeEntity( tile );
                delete this.movables[tilecoord];
            }
        }

        

        // hidden wall reverted 
        for ( let tilecoord in this.removables ) {
            if ( this.removables[tilecoord][1] == 9 ) {
                let tile = this.removables[ tilecoord ][0];
                this.change_uv_face( tile, 2, 13, 16,16 );
            }
        }

        // monster
        for ( let tilecoord in this.monsters ) {
            let tile = this.monsters[tilecoord][0];
            engine.removeEntity( tile );
            delete this.monsters[tilecoord];
        }
        

        //player
        this.player_stats.length = 0;
        this.load_dynamic_objects( this.current_level_obj );
    }










    //----------
    // this loads only the static.
    load_level( layers ) {

        
        resources["ui"]["gamestatus"].chip_remaining = 0;
        this.current_level_obj = layers;
        
        for ( let ly = 0; ly < layers.length ; ly++ ) {

            this.current_level_obj_index[  layers[ly].name  ] = ly;
            
            //console.log( layers[ly].name );
            if ( ["bg","fg","item"].indexOf( layers[ly].name ) > -1 ) {

                for ( let i = 0 ; i < layers[ly].data.length ; i++ ) {

                    let x_tile = i % 32;
                    let z_tile =  (i / 32) >> 0 ;
                    let tile;
                    
                    if ( layers[ly].name == "bg" ) {
                        
                        if ( layers[ly].data[i] == 33 ) {

                            // 33: standard floor
                            tile = this.create_textured_block( 
                                (x_tile - 15 ) * this.tile_size,
                                0, 
                                (-z_tile + 15 ) * this.tile_size, 

                                'images/tileset_64.png',
                                3,
                                13,
                                16,
                                16,

                                layers[ly].data[i],
                                1,
                                1,
                            );
                            

                            
                        } else if ( layers[ly].data[i] == 34 ) {

                            // 34: exit
                             
                            tile = this.create_textured_block_emissive( 
                                (x_tile - 15 ) * this.tile_size,  //x
                                0,                                //y
                                (-z_tile + 15 ) * this.tile_size, //z
                                
                                'images/tileset_64.png',
                                1,   //frame_x
                                14,   //frame_y
                                16,   //x_frames
                                16,   //y_frames

                                layers[ly].data[i],
                                
                                1,  // height
                                1   // size
                            );
                            


                        // 39-42: Force floor
                                
                        } else if ( layers[ly].data[i] >= 39 && layers[ly].data[i] <= 42  ) {

                            tile = this.create_textured_block_emissive( 
                                (x_tile - 15 ) * this.tile_size,
                                0, 
                                (-z_tile + 15 ) * this.tile_size,

                                'images/tileset_64.png',
                                3,
                                14,
                                16,
                                16,
                                layers[ly].data[i] ,

                                1,
                                1
                            );
                            
                            

                        // 43-47: Ice floor
                        } else if ( layers[ly].data[i] >= 43 && layers[ly].data[i] <= 47  ) {

                            tile = this.create_glb_block( 
                                (x_tile - 15 ) * this.tile_size,
                                0, 
                                (-z_tile + 15 ) * this.tile_size,
                                layers[ly].data[i],
                                1,
                                1
                            )
                            
                            
                        
                        // 12 Gravel
                        } else if ( layers[ly].data[i] == 12 ) {
                            
                            tile = this.create_textured_block(
                                (x_tile - 15 ) * this.tile_size,
                                0, 
                                (-z_tile + 15 ) * this.tile_size,

                                'images/tileset_64.png',
                                0,
                                13,
                                16,
                                16,
                                layers[ly].data[i] ,

                                1,
                                1
                                
                            );
                            
                            
                        }

                    

                    // Foreground
                    } else if ( layers[ly].name == "fg" ) {


                        // 1: standard wall creation
                        if ( layers[ly].data[i] == 1 ) {

                           tile = this.create_textured_block_emissive(
                                (x_tile - 15 ) * this.tile_size,
                                1, 
                                (-z_tile + 15 ) * this.tile_size, 
                                'images/tileset_64.png',
                                1,
                                13,
                                16,
                                16,
                                layers[ly].data[i],
                                1,
                                1
                           );

                            
                        // 12-15 16-19 Thin wall creation
                        } else if ( layers[ly].data[i] >= 13 && layers[ly].data[i] <= 20  ) { 
                            tile = this.create_glb_block( 
                                (x_tile - 15 ) * this.tile_size,
                                0.5, 
                                (-z_tile + 15 ) * this.tile_size, 
                                layers[ly].data[i],
                                1,
                                1,
                            );
                        }



                    } else if ( layers[ly].name == "item" ) {


                        // GLBs:
                        // 48 : blue button creation,
                        // 49 : green button creation,
                        // 80 : red button creation
                        // 81 : yellow button creation
                        // 82 : grey button creation


                        // 84 ：teleport creation
                        // 52 : trap  creation
                        // 129: thief creation
                        // Textured blocks:
                        // 50,51: Toggle door creation
                        // 53 : recessed wall creation.
                        //  8 : clone machine creation

                        
                        let static_textured_blocks          = [ 50,51,53, 8];
                        let static_textured_blocks_index    = static_textured_blocks.indexOf( layers[ly].data[i] );
                        
                        let static_glbs         = [ 48,49, 80, 81, 84, 52, 129, 82];
                        let static_glbs_index   = static_glbs.indexOf( layers[ly].data[i] );
                            

                        if ( layers[ly].data[i] == 82 ) {
                            this.sokoban_holes[ i ] = 1;
                        }
                        
                        // 50,51,53 : The indicator 
                        if ( static_textured_blocks_index > -1 ) {

                            let frame_x = 2;
                            if ( layers[ly].data[i] == 8 ) {
                                frame_x = 4;
                            }

                            tile = this.create_textured_block_emissive( 

                                (x_tile - 15 ) * this.tile_size,  //x
                                0.05,                                //y
                                (-z_tile + 15 ) * this.tile_size, //z
                                
                                'images/tileset_64.png',
                                frame_x,   //frame_x
                                14,   //frame_y
                                16,   //x_frames
                                16,   //y_frames

                                layers[ly].data[i],
                                
                                1,  // height
                                1   // size
                            );
                               

                        } else if ( static_glbs_index > -1 ) {


                            // glbs
                            tile = this.create_glb_block( 
                                (x_tile - 15 ) * this.tile_size,  //x
                                0.5,                                //y
                                (-z_tile + 15 ) * this.tile_size, //z

                                layers[ly].data[i],

                                1,
                                1
                            );
                            
                            if ( layers[ly].data[i] == 84 ) {
                                this.teleports.push( i );
                            }
                        }

                    } // layer.name == ?
                
                    this.static_tiles.push( [ tile, layers[ly].data[i] , 0, i , 0 ] );   

                } // foreach i in data



            } else if ( ["object"].indexOf( layers[ly].name ) > -1 ) {
                
                for ( let i = 0 ; i < layers[ly].objects.length ; i++ ) {
                    let obj = layers[ly].objects[i];
                    if ( ["switch", "direction","hint", "exit"].indexOf( obj.type ) > -1  ) {
                        
                        let properties = {};
                        for ( let j = 0 ; j < obj.properties.length ; j++ ) {
                            properties[ obj.properties[j].name ] = obj.properties[j].value;
                        }

                        let tilecoord = properties["tile_y"] * 32 + properties["tile_x"];
                            
                        if ( obj.type == "switch" ) {
                            
                            let target_tilecoord = properties["target_tile_y"] * 32 + properties["target_tile_x"];
                            this.src_and_target[ tilecoord ] = target_tilecoord;

                        } else if ( obj.type == "direction" ) {

                            this.directions[ tilecoord ] =  properties["direction"];
                        
                        } else if ( obj.type == "hint" ) {
                            
                            let x_tile = properties["tile_x"];
                            let z_tile = properties["tile_y"];

                            let tile = this.create_textured_block_emissive( 

                                (x_tile - 15 ) * this.tile_size,  //x
                                0.05,                             //y
                                (-z_tile + 15 ) * this.tile_size, //z
                                
                                'images/tileset_64.png',
                                5,   //frame_x
                                14,   //frame_y
                                16,   //x_frames
                                16,   //y_frames

                                36,
                                1,  // height
                                1   // size
                            );
                            this.static_tiles.push( [ tile, 36 , 0, tilecoord , 0 ] );  
                            this.hints[ tilecoord ] =  properties["txt"];
                            
                        } else if ( obj.type == "exit" ) {
                            this.exits[ tilecoord ] = properties["to_level"];
                        }
                    }
                }
            }
            
        }
        this.load_dynamic_objects( layers );

    }

    

    //-----------
    // this loads objects that can be reset.
    // LDO
    load_dynamic_objects( layers ) {

        
        for ( let ly = 0 ; ly < layers.length ; ly++ ) {

            if ( ["fg", "bg", "item","removable","monster"].indexOf( layers[ly].name ) > -1 ) {

                for ( let i = 0 ; i < layers[ly].data.length ; i++ ) {

                    let x_tile = i % 32;
                    let z_tile =  (i / 32) >> 0 ;
                    
                    // bg layer
                    if ( layers[ly].name == "bg" ) {

                        // 37: water creation (This can be on bg or removable layer)
                        if ( layers[ly].data[i] == 37 ) {

                            if ( this.removables[ i ] == null ) {
                                
                                let tile = this.create_glb_block( 
                                    (x_tile - 15 ) * this.tile_size,
                                    -0.3, 
                                    (-z_tile + 15 ) * this.tile_size,
                                    layers[ly].data[i],
                                    1,
                                    1
                                )
                                this.removables[ i ] = [ tile, layers[ly].data[i] ];
                            }


                        // 11 :Dirt creation (This can be on bg or removable layer)
                        } else if ( layers[ly].data[i] == 11 ) {
                            this.create_dirt( i , layers[ly].data[i] );
                        }

                    //-------------------------------
                    // removable layer
                    } if ( layers[ly].name == "removable" ) {

                        // 99 bomb creation
                        if ( layers[ly].data[i] == 99  ) {

                            if ( this.removables[ i ] == null ) {
                                
                                let tile = this.create_glb_block( 
                                    (x_tile - 15 ) * this.tile_size,
                                    0.8, 
                                    (-z_tile + 15 ) * this.tile_size,
                                    layers[ly].data[i],
                                    0.6,
                                    0.6
                                )
                                this.removables[ i ] = [ tile, layers[ly].data[i] ];
                            }

                        
                        // 37: water creation (This can be bg or removable both acceptable)
                        } else if ( layers[ly].data[i] == 37 ) {

                            if ( this.removables[ i ] == null ) {
                                
                                let tile = this.create_glb_block( 
                                    (x_tile - 15 ) * this.tile_size,
                                    -0.3, 
                                    (-z_tile + 15 ) * this.tile_size,
                                    layers[ly].data[i],
                                    1,
                                    1
                                )
                                this.removables[ i ] = [ tile, layers[ly].data[i] ];
                            }

                        // 38: fire creation
                        } else if ( layers[ly].data[i] == 38 ) {

                            if ( this.removables[ i ] == null ) {
                                
                                let tile = this.create_glb_block( 
                                    (x_tile - 15 ) * this.tile_size,
                                    0.4, 
                                    (-z_tile + 15 ) * this.tile_size,
                                    layers[ly].data[i],
                                    1,
                                    1
                                )
                                this.removables[ i ] = [ tile, layers[ly].data[i] ];
                            }


                        // 2,3,4,5 : lockpad wall creation  
                        // 6 crystal wall creation
                        } else if ( [2,3,4,5,6, 21 ].indexOf( layers[ly].data[i] ) > -1  ) {
                            
                            if ( this.removables[ i ] == null ) {

                                // padlock wall refill
                                let frame_x = 0;
                                let frame_y = 15;

                                if ( layers[ly].data[i] == 6 ) {
                                    frame_x = 0;
                                    frame_y = 14;
                                } else if ( layers[ly].data[i] == 21 ) {
                                    frame_x = 6;
                                    frame_y = 14;
                                }

                                let tile = this.create_textured_block_emissive( 
                                    (x_tile - 15 ) * this.tile_size,  //x
                                    1,                                //y
                                    (-z_tile + 15 ) * this.tile_size, //z
                                    
                                    'images/tileset_64.png',
                                    frame_x,   //frame_x
                                    frame_y,   //frame_y
                                    16,   //x_frames
                                    16,   //y_frames

                                    layers[ly].data[i],
                                    
                                    1,  // height
                                    1   // size
                                );

                                this.removables[ i ] = [ tile, layers[ly].data[i] ];
                            }

                        // 7: movable block creation
                        } else if ( layers[ly].data[i] == 7 ) {

                            if ( this.movables[ i ] == null ) {
                                
                                let tile = this.create_glb_block( 
                                    (x_tile - 15 ) * this.tile_size,
                                    1, 
                                    (-z_tile + 15 ) * this.tile_size,
                                    layers[ly].data[i],
                                    1,
                                    1
                                );
                                this.movables[ i ] = [ tile , 7 ];

                            }
                        
                        // 9,10 hidden wall creation
                        } else if ( [9,10].indexOf( layers[ly].data[i] ) > -1  ) {
                            
                            if ( this.removables[ i ] == null ) {

                                let tile = this.create_textured_block_emissive( 
                                    (x_tile - 15 ) * this.tile_size,
                                    1, 
                                    (-z_tile + 15 ) * this.tile_size,

                                    'images/tileset_64.png',
                                    2,
                                    13,
                                    16,
                                    16,
                                    layers[ly].data[i],
                                    1,
                                    1
                                );
                                this.removables[ i ] = [ tile ,  layers[ly].data[i]  ];

                            }
                        
                        
                        // 11 dirt creation
                        } else if ( layers[ly].data[i] == 11 ) {

                            this.create_dirt( i , layers[ly].data[i] );
                            
                        }


                    
                    
                    //-------------------------------
                    //  item layer
                    } else if ( layers[ly].name == "item" ) {

                        // 35: Starting position creation
                        if ( layers[ly].data[i] == 35 ) {
                            
                            this.player_pos.x = x_tile ;
                            this.player_pos.z = z_tile ;
                            this.player_align_avatar_to_player_pos_tilecoord()
                            



                        // 66,67,68,69: coloured keys creation 
                        // 65 chip creation
                        
                        } else if ( layers[ly].data[i] >= 65 && layers[ly].data[i] <= 69 ) {

                            if ( this.pickables[ i ] == null ) {

                                let frame_x = 1;
                                let frame_y = 15;
                                let size = 0.8;

                                if ( layers[ly].data[i]  == 65 ) {
                                    frame_x = 2;
                                    size = 0.7;
                                }

                                let tile = this.create_item_plane_emissive( 

                                    (x_tile - 15 ) * this.tile_size,
                                    1, 
                                    (-z_tile + 15 ) * this.tile_size, 

                                    'images/tileset_64.png',
                                    frame_x,
                                    frame_y,
                                    layers[ly].data[i],

                                    size
                                );
                                Billboard.create( tile );
                                this.pickables[ i ] = [ tile, layers[ly].data[i] ];
                                
                                // Chip
                                if ( layers[ly].data[i] == 65 ) {
                                    resources["ui"]["gamestatus"].chip_remaining += 1;
                                }
                            }

                        // 70,71,72,73: boots
                        // boots creation
                        } else if ( layers[ly].data[i] >= 70 &&  layers[ly].data[i] <= 73 ) {

                            if ( this.pickables[ i ] == null ) {

                                let tile = this.create_glb_block(
                                    (x_tile - 15 ) * this.tile_size,
                                    0.8, 
                                    (-z_tile + 15 ) * this.tile_size, 

                                    layers[ly].data[i],
                                    0.5,
                                    0.5,
                                );

                                this.pickables[ i ] = [ tile, layers[ly].data[i] ];
                            }

                        // 50,51 toggle door , dynamic part creation
                        } else if ( layers[ly].data[i] >= 50 &&  layers[ly].data[i] <= 51 ) {
                            
                            if ( this.togglables[ i ] == null ) {

                                let status  = layers[ly].data[i] - 50;
                                let y       = [ -2,1 ][status] 

                                let tile = this.create_textured_block_emissive(
                                    (x_tile - 15 ) * this.tile_size,
                                    y, 
                                    (-z_tile + 15 ) * this.tile_size, 

                                    'images/tileset_64.png',
                                    1,
                                    13,
                                    16,
                                    16,
                                    
                                    1,
                                    1,
                                    0.9 
                               );

                                this.togglables[i] = [ tile, layers[ly].data[i] , status ];
                            }    

                        }




                    } else if ( layers[ly].name == "monster" ) {
                        
                        // Monsters creation
                        // 97 bug creation
                        // 98 tank creation
                        // 100 glider creation
                        // 101 fireball creation
                        // 102 pink ball creation

                        // 103 eye ball creation
                        // 104 paramecium
                        // 105 blob
                        // 106 walker
                        if ( layers[ly].data[i] > 0 ) {
                            this.create_monster( i , layers[ly].data[i] , this.directions[i] );
                        }
                    }

                }
            }
        }
    }



    //------------
    get_left_direction( head_direction ) {

        // North
        if ( head_direction == -32 ) {
            return -1;

        // West
        } else if ( head_direction == -1 ) {
            return 32;
        
        // South
        } else if ( head_direction == 32 ) {
            return 1;
        
        // East
        } else if ( head_direction == 1 ) {
            return -32;
        }
        return -1;
    }

    



    //-------------------
    monsters_next_move( tilecoord:number ) {


        if ( this.monsters[ tilecoord ] ) {

            let monster = this.monsters[tilecoord];

            // 0 tile 
            // 1 type
            // 2 lerp_progress
            // 3 start
            // 4 end,
            // 5 isdead
            // 6 head direction
            // 9 istrapped

            if ( monster[9] != 1)  {


                
                // Initialize direction if not already.
                if ( monster[6] == null ) {

                    if ( monster[1] == 102 || monster[1] == 101 || monster[1] == 104 ) {
                        monster[6] = -1;
                        
                    } else {
                        monster[6] = -32;
                    }
                }
                


                // If on clone machine, need not to perform where to move next
                if ( this.current_level_obj[ this.current_level_obj_index["item"] ].data[ tilecoord ] == 8 ) {
                    return ;
                }

                
                

                let s_tile_x =  tilecoord % 32;
                let s_tile_z = (tilecoord / 32) >> 0;

                let sx = ( s_tile_x - 15 ) * this.tile_size;
                let sy = Transform.getMutable( monster[0] ).position.y; 
                let sz = (-s_tile_z + 15 ) * this.tile_size;
                let e_tilecoord = tilecoord;
                
                let left_direction = this.get_left_direction( monster[6] );
                    
                //--------------------------------
                // 97 red spider 
                if ( monster[1] == 97 ) {

                    if ( this.check_is_tile_passable_for_monster(  tilecoord + left_direction, monster[1] , left_direction ) == true ) {

                        // left
                        e_tilecoord = tilecoord + left_direction;
                        monster[6] = left_direction;
                        
                    } else if ( this.check_is_tile_passable_for_monster( tilecoord + monster[6], monster[1] , monster[6] ) == true ) {

                        // forward
                        e_tilecoord = tilecoord + monster[6];
                        
                    } else if ( this.check_is_tile_passable_for_monster( tilecoord - left_direction , monster[1], -left_direction ) == true ) {
                        
                        // right
                        e_tilecoord = tilecoord - left_direction;
                        monster[6] = -left_direction;
                    
                    } else if ( this.check_is_tile_passable_for_monster( tilecoord - monster[6], monster[1] , monster[6] ) == true ) {

                        // backward
                        e_tilecoord = tilecoord - monster[6];
                        monster[6] = -monster[6];
                    }
                    monster[8] = 0.08;
                    
                    
                // 104 blue spider 
                } else if ( monster[1] == 104 ) {

                    if ( this.check_is_tile_passable_for_monster(  tilecoord - left_direction, monster[1] , -left_direction ) == true ) {

                        // right
                        e_tilecoord = tilecoord - left_direction;
                        monster[6] = -left_direction;
                        
                    } else if ( this.check_is_tile_passable_for_monster( tilecoord + monster[6], monster[1] , monster[6] ) == true ) {

                        // Forward
                        e_tilecoord = tilecoord + monster[6];
                        
                    } else if ( this.check_is_tile_passable_for_monster( tilecoord + left_direction , monster[1], left_direction ) == true ) {
                        
                        // left
                        e_tilecoord = tilecoord + left_direction;
                        monster[6] = left_direction;
                    
                    } else if ( this.check_is_tile_passable_for_monster( tilecoord - monster[6], monster[1] , monster[6] ) == true ) {

                        // backward
                        e_tilecoord = tilecoord - monster[6];
                        monster[6] = -monster[6];
                    }
                    monster[8] = 0.08;
                
                

                //--------------------------------
                // 98 blue tank
                } else if ( monster[1] == 98 )  {

                    e_tilecoord = tilecoord;
                    if ( this.check_is_tile_passable_for_monster( tilecoord + monster[6], monster[1] , monster[6] ) == true ) {
                        // Up
                        e_tilecoord = tilecoord + monster[6];
                    }
                    monster[8] = 0.08;
                
                //----------------------------
                // 100 glider
                } else if ( monster[1] == 100 ) {

                    if ( this.check_is_tile_passable_for_monster(  tilecoord + monster[6], monster[1] , monster[6] ) == true ) {
                        // Front
                        e_tilecoord = tilecoord + monster[6];

                    } else if ( this.check_is_tile_passable_for_monster(  tilecoord + left_direction, monster[1], left_direction ) == true ) {

                        // left
                        e_tilecoord = tilecoord + left_direction;
                        monster[6] = left_direction;
                        
                    } else if ( this.check_is_tile_passable_for_monster(  tilecoord - left_direction, monster[1] , -left_direction ) == true ) {
                        
                        // right
                        e_tilecoord = tilecoord - left_direction;
                        monster[6] = -left_direction;
                    
                    } else if ( this.check_is_tile_passable_for_monster(  tilecoord - monster[6] , monster[1], -monster[6] ) == true ) {

                        // back
                        e_tilecoord = tilecoord - monster[6];
                        monster[6] = -monster[6];
                    }
                    monster[8] = 0.08;

                //-----------
                // 101 Fireball 
                } else if ( monster[1] == 101 ) {

                    if ( this.check_is_tile_passable_for_monster(   tilecoord + monster[6], monster[1] , monster[6] ) == true ) {
                        // Front
                        e_tilecoord = tilecoord + monster[6];

                    } else if ( this.check_is_tile_passable_for_monster(  tilecoord - left_direction, monster[1] , -left_direction ) == true ) {
                        
                        // right
                        e_tilecoord = tilecoord - left_direction;
                        monster[6] = -left_direction;

                    } else if ( this.check_is_tile_passable_for_monster(  tilecoord + left_direction, monster[1], left_direction ) == true ) {

                        // left
                        e_tilecoord = tilecoord + left_direction;
                        monster[6] = left_direction;
                    
                    } else if ( this.check_is_tile_passable_for_monster(  tilecoord - monster[6], monster[1] , -monster[6] ) == true ) {

                        // back
                        e_tilecoord = tilecoord - monster[6];
                        monster[6] = -monster[6];
                    }

                    // speed
                    monster[8] = 0.16;

                //--------------
                // 102 Pink ball
                } else if ( monster[1] == 102 ) {

                    if ( this.check_is_tile_passable_for_monster(   tilecoord + monster[6], monster[1], monster[6] ) == true ) {

                        // front
                        e_tilecoord = tilecoord + monster[6];

                    } else if ( this.check_is_tile_passable_for_monster( tilecoord - monster[6], monster[1], -monster[6] ) == true ) {

                        // back
                        e_tilecoord = tilecoord - monster[6];
                        monster[6] = -monster[6];
                    }
                    monster[8] = 0.10;
                
                
                //-----------
                // 103 pacman
                // moves either vertically or horizontally toward player one square at a time, 
                // always taking the longer path, and vertically if tied
                } else if ( monster[1] == 103 ) {
                    
                    let x_diff = this.player_pos.x - s_tile_x;
                    let z_diff = this.player_pos.z - s_tile_z;

                    let possible_moves:any[] = [];
                    if ( Math.abs( z_diff ) >= Math.abs( x_diff ) ) {
                        if ( z_diff != 0 ) {
                            possible_moves.push( z_diff > 0 ? 32: -32 );
                        }
                        if ( x_diff != 0 ) {
                            possible_moves.push( x_diff > 0 ?  1:  -1 );
                        }
                    } else {
                        if ( x_diff != 0 ) {
                            possible_moves.push( x_diff > 0 ?  1:  -1 );
                        }
                        if ( z_diff != 0 ) {
                            possible_moves.push( z_diff > 0 ? 32: -32 );
                        }
                    }
                    
                    for ( let i = 0 ; i < possible_moves.length ; i++ ) {
                        let direction = possible_moves[i];
                        if (  this.check_is_tile_passable_for_monster( tilecoord + direction, monster[1], direction ) == true ) {   
                            e_tilecoord = tilecoord + direction;
                            monster[6] = direction;
                            break; 
                        }
                    }
                    monster[8] = 0.09;

                }

                
                    
                let e_tile_x =   e_tilecoord % 32;
                let e_tile_z = ( e_tilecoord / 32)  >> 0;
                let ex = ( e_tile_x - 15 ) * this.tile_size;
                let ey = sy; 
                let ez = (-e_tile_z + 15 ) * this.tile_size;
                
                monster[2] = 0;
                monster[3] = Vector3.create( sx, sy, sz );
                monster[4] = Vector3.create( ex, ey, ez );
                monster[7] = tilecoord;   // Save the old tilecoord
                // Take the new tilecoord 
                if ( e_tilecoord != tilecoord ) {
                    
                    delete this.monsters[tilecoord];
                    this.monsters[e_tilecoord] = monster
                    
                    monster[10] = null;

                }
            }   
        }
    }

    //-----
    console_log_tilecoord( label, tilecoord) {
        console.log( label , tilecoord % 32 , ",", (tilecoord / 32) >> 0 );
    }   

    //------------

    update( dt ) {

        let _this = resources["stage"];


        if ( _this.game_state == 0 ) {

            // player
            if ( _this.player_stats[2] != null ) {
                
                let start    = _this.player_stats[3];
                let end      = _this.player_stats[4];
                let direction = _this.player_stats[6];
                let speed     = _this.player_stats[8]; 
                
                
                _this.player_stats[2] += speed;
                if ( _this.player_stats[2] > 1.0 ) {
                    _this.player_stats[2] = 1.0;
                }

                let cur_tilecoord   = _this.player_pos.z * 32 + _this.player_pos.x;
                let new_tilecoord   = _this.player_stats[7];

                Transform.getMutable( _this.player ).position = Vector3.lerp( start, end ,  _this.player_stats[2] );
                Transform.getMutable( _this.player ).rotation = Quaternion.fromEulerDegrees( 0 , _this.get_y_rot_by_direction( direction), 0 );

                Animator.playSingleAnimation( _this.player , 'walk', false )

                // UPDATE PLAYER

                // If to be entered tile is not ice or force floor, then can start check_player_current_tile() at lerp progress 0.5
                //  otherwise, we only do it at lerp progress of 0.99 for smoother animation.
                //   The reason for doing early at 0.5 is because when pushing block or encountering monster,
                //      the player doesn't need to wait until the full tile is entered.

                let passed_tile_lerp_threshold = 0.5;
                if ( [39,40,41,42,43,44,45,46,47,34].indexOf( _this.current_level_obj[ _this.current_level_obj_index["bg"] ].data[new_tilecoord] ) > -1 ) { 
                    passed_tile_lerp_threshold = 0.99;
                }


                if ( _this.player_stats[2] >= passed_tile_lerp_threshold && _this.player_stats[10] == null ) {

                    _this.player_stats[10] = 1;
                    _this.player_pos.x =   new_tilecoord % 32;
                    _this.player_pos.z = ( new_tilecoord / 32 ) >> 0;  
                    _this.pickup_items();
                    _this.check_player_current_tile( cur_tilecoord ); //first arg is prev_tilecoord
                    _this.push_movable_block( direction );
                }   
                
                if (  _this.player_stats[2] >= 0.99 ) {
                
                    

                    _this.player_stats[2] = null;
                    _this.player_align_avatar_to_player_pos_tilecoord();
                    _this.player_stats[10] = null;
                   
                }
            } 

                let has_down = 0;

                // Forward always takes precedence
                if (resources["button_states"][InputAction.IA_FORWARD] == 1 ) { 
                    Transform.getMutable( _this.player ).rotation = Quaternion.fromEulerDegrees( 0 , 0, 0 );
                    _this.move_player(-32);
                    has_down = 1;

                } else if ( resources["button_states"][InputAction.IA_LEFT] == 1 ) {

                    Transform.getMutable( _this.player ).rotation = Quaternion.fromEulerDegrees( 0 , -90, 0 );
                    _this.move_player(-1);
                    has_down = 1;
                        
                } else if ( resources["button_states"][InputAction.IA_RIGHT] == 1) {
                    Transform.getMutable( _this.player ).rotation = Quaternion.fromEulerDegrees( 0 , 90, 0 );
                    _this.move_player(1);
                    has_down = 1;
                    
                } else if ( resources["button_states"][InputAction.IA_BACKWARD] == 1) {
                    Transform.getMutable( _this.player ).rotation = Quaternion.fromEulerDegrees( 0 , 180, 0 );
                    _this.move_player(32);
                    has_down = 1;
                    
                }
                if ( has_down == 1 ) {
                   
                } else { 
                     Animator.playSingleAnimation( _this.player , 'idle', false )
                }


            




            // movable blocks
            for ( let key in _this.movables ) {
                
                let tilecoord = parseInt(key);
                
                if ( _this.movables[tilecoord][2] != null ) {
                    
                   
                    let tile            = _this.movables[tilecoord][0];
                    let start           = _this.movables[tilecoord][3];
                    let end             = _this.movables[tilecoord][4];
                    let old_tilecoord   = _this.movables[tilecoord][7];
                    let speed           = _this.movables[tilecoord][8];
                    

                    _this.movables[tilecoord][2] += speed;
                    // Dont over step the lerp boundary
                    if ( _this.movables[ tilecoord ][2] > 1.0 ) {
                        _this.movables[ tilecoord ][2] = 1.0;
                    }

                    Transform.getMutable( tile ).position = Vector3.lerp( start, end, _this.movables[tilecoord][2] );
                    
                    // UPDATE MOVABLE BLOCKS

                    // Reach destination
                    if ( _this.movables[tilecoord][2] >= 0.99 ) {
                        _this.movables[tilecoord][2] = null ;

                        if ( _this.movables[tilecoord][10] == null  ) {
                            _this.movables[tilecoord][10] = 1;
                            
                            _this.check_movable_block_current_tile( tilecoord, old_tilecoord );
                            resources["index"].play_sound("stone");
                            
                        }
                    }
                }
            }

            // Monster
            for ( let key in _this.monsters ) {

                let tilecoord = parseInt(key);
                let tile            = _this.monsters[tilecoord][0];
                let type            = _this.monsters[tilecoord][1];
                let progress        = _this.monsters[tilecoord][2];    
                

                if ( progress != null ) {

                    let start           = _this.monsters[tilecoord][3];
                    let end             = _this.monsters[tilecoord][4];
                    let direction       = _this.monsters[tilecoord][6];
                    let old_tilecoord   = _this.monsters[tilecoord][7];
                    let speed           = _this.monsters[tilecoord][8];
                    let is_trapped      = _this.monsters[tilecoord][9];

                    if ( speed == null ) {
                        speed = 0.05;
                    }

                    let is_on_clone_machine = 0;
                    if ( _this.current_level_obj[ _this.current_level_obj_index["item"] ].data[ tilecoord ] == 8 ) {
                        is_on_clone_machine = 1;
                    }

                    // 97 red spider 
                    // 98 bluetank
                    // 100 glider
                    // 101 fireball
                    // 102 pink ball
                    // 103 pacman
                    // 104 blue spider

                    if ( [ 97, 98, 100, 101, 102, 103, 104 ].indexOf( type ) > -1 ) {

                        if ( is_trapped != 1 && is_on_clone_machine != 1 ) {

                            _this.monsters[tilecoord][2] += speed;
                            if ( _this.monsters[tilecoord][2] > 1.0 ) {
                                _this.monsters[tilecoord][2] = 1.0;
                            }

                            Transform.getMutable( tile ).position = Vector3.lerp( start, end, _this.monsters[tilecoord][2]  );
                            
                            if ( type == 103 ) {
                                
                                resources["index"].lookAt( tile , _this.player );
                                
                            } else {
                                Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees( 0 , _this.get_y_rot_by_direction(direction) , 0 );
                            }

                            
                            if ( progress <= 0.5 ) {
                                // if slerp progress <50% the monster is counted as still at current tile.
                                if ( _this.player_pos.z * 32 + _this.player_pos.x == old_tilecoord ) {
                                    _this.gameover("Killed by a monster");
                                }
                            } else {
                                // if slerp progress >50 the monster is counted as at the destination tile
                                if ( _this.player_pos.z * 32 + _this.player_pos.x == tilecoord ) {
                                    _this.gameover("Killed by a monster");
                                }
                            }

                            if ( _this.monsters[tilecoord][2] >= 0.99 ) {
                                
                                
                                // Only generate next move if not trapped.
                                if ( _this.monsters[tilecoord][10] == null  ) {
                                    _this.monsters[tilecoord][10] = 1;
                                    _this.check_monster_current_tile(  tilecoord );
                                }
                                _this.monsters_next_move( tilecoord );
                                
                                
                            }
                        }
                            
                        

                    } 
                }
            }
        } else if ( _this.game_state == 3 ) {
            
            
        }





        if ( _this.explosions.length > 0 ) {

            for ( let i = _this.explosions.length - 1 ; i>= 0 ; i-- ) {
            
                let explosion = _this.explosions[i];
                
                let tile     = explosion[0]
                let type     = explosion[1];
                let progress = explosion[2];

                if ( progress < 40 ) {

                    explosion[2] += 1;

                    let x_frames = 5;
                    let y_frames = 4;
                    let frame_x = progress % x_frames;
                    let frame_y = 4 - ( (progress / x_frames ) >> 0 );
                    
                    MeshRenderer.setPlane(tile, [
            
                        // T
                        (frame_x )/x_frames               , frame_y / y_frames,
                        (frame_x )/x_frames               , (frame_y+1) / y_frames,
                        (frame_x + 1)/x_frames            , (frame_y+1) / y_frames,
                        (frame_x + 1 )/x_frames           , frame_y / y_frames,
                        
                        // B
                        (frame_x )/x_frames               , frame_y / y_frames,
                        (frame_x )/x_frames               , (frame_y+1) / y_frames,
                        (frame_x + 1)/x_frames            , (frame_y+1) / y_frames,
                        (frame_x + 1 )/x_frames           , frame_y / y_frames,
                        
                    ]);

                } else {
                    
                    _this.explosions.splice( i , 1 );
                    engine.removeEntity( tile );
                    
                }
            }
        }   
    }
}

