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


import level01 from "./levels/level01";
import level02 from "./levels/level02";
import level03 from "./levels/level03";
import level04 from "./levels/level04";
import level05 from "./levels/level05";
import level06 from "./levels/level06";
import level07 from "./levels/level07";
import debug from "./levels/debug";

import resources from "./resources";


//-------------------
export class Stage {

    public root;
    public tile_size = 1.000;
    public player;
    public entities = [];
    public current_level_obj:any = null;

    public player_pos = Vector3.create(0,0,0);
    public player_stats:any[] = []; 

    public pickables = {};
    public removables = {};
    public movables = {};
    public creatables = {};
    public monsters = {};
    public togglables = {};
    public src_and_target = {};
    public teleports:any[] = [];
    public explosions:any[] = [];
    
    
    public current_level_obj_index = {};
    public game_state = 0;
    public standard_wall_color = Color4.fromInts(  6 , 19, 94 ,255);
    public standard_floor_color = Color4.fromInts( 39, 32, 30, 255);



    //-----------------
    constructor( aPos )  {

        let root = engine.addEntity();
        Transform.create( root, {
            position: aPos 
        });
        this.root = root;
        this.create_player();
        this.load_level( debug.layers );
        engine.addSystem( this.update );
        

    }


    //--------
    open_lock_if_bump_into_one( tilecoord ) {
        
        if ( this.removables[ tilecoord ] != null ) {
            
            let tile    = this.removables[ tilecoord ][0];
            let item_id = this.removables[ tilecoord ][1];

            // 2-5 padlock
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

            // 6 socket
            } else if ( item_id == 6 ) {
                if ( resources["ui"]["gamestatus"].chip_remaining <= 0 ) {

                    resources["index"].play_sound("success");
                    engine.removeEntity( tile );
                    delete this.removables[ tilecoord ];
                    
                } else {
                    resources["index"].play_sound("denied");
                }
            


            // 9 - 10: hidden wall
            } else if ( item_id == 9 ) {
                Material.setPbrMaterial(tile, {
                    albedoColor: this.standard_wall_color,
                    metallic: 0,
                    roughness: 1,
                });


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


    


    //--------
    // CPCT
    check_player_current_tile(  prev_tilecoord ) {
        
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
                this.gameover();
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
                this.gameover();
            }
        }


        // 99: Bomb
        if ( this.removables[ tilecoord ] && this.removables[ tilecoord ][1] == 99  ) {
            
            //resources["index"].play_sound("explosion");
            this.create_explosions_on_tile( tilecoord );
            this.gameover();
        }


            


        // 39-42 Force floor
        
        // 39: left , 40: up , 41: right  , 42: down
        if ( tile_data_bg >= 39 && tile_data_bg <= 42  ) {

            let inventory_id = 6;
            // has force floor boot
            if ( resources["ui"]["inventory"]["items"][inventory_id].count > 0 ) {
                // survive
            } else {

                // BOOKMARK STEP ON FORCE FLOOR
                
                let direction     = [-1,-32,1,32][ tile_data_bg - 39 ];
                let new_tilecoord = tilecoord + direction;
                
                // for consistency with monster,  2: progress, 6:direction, 7: new_tilecoord
                this.player_stats[2] = 0;
                this.player_stats[3] = this.player_tilecoord_to_position( tilecoord );
                this.player_stats[4] = this.player_tilecoord_to_position( new_tilecoord );
                this.player_stats[6] = direction 
                this.player_stats[7] = new_tilecoord;
                this.player_stats[8] = 0.15;  //speed
                this.player_stats[10] = null;

                
            }
        }
        
        // 43-47 Ice Floor
        // 43: center , 44: corners DR, 45: DL, 46: UR,  47: UL
        if ( tile_data_bg >= 43 && tile_data_bg <= 47 ) {

            let inventory_id = 7;
            // has force floor boot
            if ( resources["ui"]["inventory"]["items"][inventory_id].count > 0 ) {
                // survive

            } else {       
                let direction = tilecoord - prev_tilecoord;
                let new_tilecoord;

                if ( tile_data_bg == 43 ) {
                    new_tilecoord = tilecoord + direction;
                
                } else if ( tile_data_bg == 44 ) {
                    
                    if ( direction == -1 ) {
                        new_tilecoord = tilecoord + 32;
                    } else if ( direction == -32 ) {
                        new_tilecoord = tilecoord + 1;
                    }
                } else if ( tile_data_bg == 45 ) {
                    
                    if ( direction == 1 ) {
                        new_tilecoord = tilecoord + 32;
                    } else if ( direction == -32 ) {
                        new_tilecoord = tilecoord - 1;
                    }
                } else if ( tile_data_bg == 46 ) {
                    
                    if ( direction == -1 ) {
                        new_tilecoord = tilecoord - 32;
                    } else if ( direction == 32 ) {
                        new_tilecoord = tilecoord + 1;
                    }

                } else if ( tile_data_bg == 47 ) {
                    
                    if ( direction == 1 ) {
                        new_tilecoord = tilecoord - 32;
                    } else if ( direction == 32 ) {
                        new_tilecoord = tilecoord - 1;
                    }
                } 

                this.player_stats[2] = 0;
                this.player_stats[3] = this.player_tilecoord_to_position( tilecoord );
                this.player_stats[4] = this.player_tilecoord_to_position( new_tilecoord );
                this.player_stats[6] = direction 
                this.player_stats[7] = new_tilecoord;
                this.player_stats[8] = 0.15;  //speed
                this.player_stats[10] = null;
                
                
            }
        }

        // 48: Blue button,
        if ( tile_data_item == 48 ) {
            
            resources["index"].play_sound("buttonshort");

            for ( let tilecoord in this.monsters ) {
                if ( this.monsters[tilecoord] && this.monsters[tilecoord][1] == 98 ) {
                    this.monsters[ tilecoord ][6] = -this.monsters[ tilecoord ][6];
                }
            }
        }

        // 49: Green button
        if ( tile_data_item == 49 ) {
            
            for ( let tilecoord in this.togglables ) {

                this.togglables[ tilecoord ][2] = 1 - this.togglables[ tilecoord ][2];
                resources["index"].play_sound("buttonshort");

                let tile = this.togglables[ tilecoord ][0] ;
                if ( this.togglables[ tilecoord ][2] == 0 ) {
                    Transform.getMutable(tile).position.y = -2;
                } else {
                    Transform.getMutable(tile).position.y = 1;
                }
                
            }
        }

        // 81: Brown button 
        if ( tile_data_item == 81 ) {

            resources["index"].play_sound("buttonshort");

            if ( this.src_and_target[ tilecoord ] ) {
                let target_tilecoord         = this.src_and_target[ tilecoord ];
                let target_tile_data_item   = this.current_level_obj[ this.current_level_obj_index["item"] ].data[ target_tilecoord ];
                // Release trap 
                if ( target_tile_data_item == 52 && this.monsters[ target_tilecoord ] && this.monsters[ target_tilecoord][9] == 1 ) {
                    this.monsters[ target_tilecoord][9] = null;
                }
            }
        }

        // 80: Red button 
        if ( tile_data_item == 80 ) {
            resources["index"].play_sound("buttonshort");

        }

        // 84: Teleport 
        if ( tile_data_item == 84 ) {
            
            
            let curindex    = this.teleports.indexOf( tilecoord );
            let targetIndex = ( curindex + this.teleports.length - 1 ) % this.teleports.length;
            let target_tilecoord = this.teleports[ targetIndex ];
            
            console.log( this.teleports.length );

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
            let tile = this.create_glb_block( 
                (x_tile - 15 ) * this.tile_size,
                1, 
                (-z_tile + 15 ) * this.tile_size, 
                1,
                0.5,
                0.9,
            );

            this.creatables[ tilecoord ] = [ tile , 1 ];
            resources["index"].play_sound( "stone" );
        }

        // 11 Dirt
        if ( this.creatables[ tilecoord ] && this.creatables[ tilecoord ][1] == 11 ) {

            this.creatables[ tilecoord ][1] = 33;
            Material.setPbrMaterial( this.creatables[ tilecoord ][0], {
                albedoColor: this.standard_floor_color,
                metallic: 0.1,
                roughness: 0.9,
            });
        }

        // 34 Exit
        if ( tile_data_bg == 34 ) {
            resources["index"].play_sound("victory");

        }

        // 52 Trap
        if ( tile_data_item == 52 ) {
            this.player_stats[9] = 1;
            resources["index"].play_sound( "oof" );
        }
    }


    //----
    check_movable_block_current_tile( tilecoord , prev_tilecoord ) {

        // Check movable block if dropped to water (37).
        if ( this.movables[ tilecoord ] ) {

            // 37: If movable block lands on water
            if ( this.removables[ tilecoord ] && this.removables[ tilecoord ][1] == 37  ) {
                // Mark to delete this movable block upon animation completes
                this.movables[ tilecoord ][5] = 2; 
                // Mark to delete this water tile upon animation completes
                this.removables[ tilecoord ][5] = 2;
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



            // If movable block lands on ice then it will slide.
            

        }
        
    }


    //--------
    // CMCT
    check_monster_current_tile(  tilecoord ) {
        
        // 52 trap
        if ( this.current_level_obj[ this.current_level_obj_index["item"] ].data[ tilecoord ] == 52 ) {
            if ( this.monsters[ tilecoord ] ) {
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

            if (  this.monsters[ tilecoord ][1] != 100 ) {
                let monster = this.monsters[ tilecoord ][0];
                engine.removeEntity( monster );
                delete this.monsters[ tilecoord ];
            }
        }

         // Red switch 
         if ( this.current_level_obj[ this.current_level_obj_index["item"] ].data[ tilecoord ]  == 80 ) {
            
            resources["index"].play_sound("buttonshort");

            
            if ( this.src_and_target[ tilecoord ] ) {
                let target_tilecoord         = this.src_and_target[ tilecoord ];
                let target_tile_data_item   = this.current_level_obj[ this.current_level_obj_index["item"] ].data[ target_tilecoord ];

                // activate clone 
                if ( target_tile_data_item == 8 && this.monsters[ target_tilecoord ] ) {
                    this.clone_monster( target_tilecoord + this.monsters[ target_tilecoord ][6] , this.monsters[ target_tilecoord ][1] );
                }
            }
        }


    }   

    //------
    clone_monster( tilecoord , type ) {

            
        if ( this.monsters[ tilecoord ] == null ) {
            
            let x_tile = tilecoord % 32;
            let z_tile = (tilecoord / 32 ) >> 0;

            let tile = this.create_glb_block( 
                (x_tile - 15 ) * this.tile_size,
                0.6, 
                (-z_tile + 15 ) * this.tile_size, 
                type,
                1,
                1
            );
            this.monsters[ tilecoord ] = [ tile, type ];
            this.monsters_next_move( tilecoord );
        }
    }




    //-------------
    check_is_tile_passable_general( tilecoord , direction ) {

        let ret = true; 
        // standard wall (1) 
        if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord  ] == 1  )  {
            ret = false;
        

        // lockpad (2-5) and socket(6)
        } else if ( this.removables[ tilecoord  ] && 
             this.removables[ tilecoord ][1] >= 2 && this.removables[ tilecoord ][1] <= 6  )  {
            ret = false;
            
        

        // togglable wall
        } else if ( this.togglables[ tilecoord  ] && 
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
        }

        return ret;

    }


    //-------
    check_is_tile_passable( tilecoord , direction ) {

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
            
            if ( this.check_is_tile_passable_for_object( tilecoord + direction , 7 , direction  ) == true ) {
               
            } else {
                // Cannot push into
                ret = false;
            }
        
        }
        
        return ret;

    }


    //----
    check_is_tile_passable_for_object( tilecoord , type , direction ) {

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
    check_is_tile_passable_for_monster( tilecoord , monster_type , direction ) {

        let ret = true;
        
        let tile_data_bg    = this.current_level_obj[ this.current_level_obj_index["bg"] ].data[ tilecoord ];

        if ( this.check_is_tile_passable_general( tilecoord, direction ) == false ) {
            ret = false;


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
    push_movable_block(  direction ) {
        
        let tilecoord =  this.player_pos.z * 32 + this.player_pos.x ;
        
        if ( this.movables[ tilecoord ] && this.movables[tilecoord][5] == null )  {    

            let tile        = this.movables[tilecoord][0];
            let tiletype    = this.movables[tilecoord][1];
            

            let srcPos      = Transform.getMutable( tile ).position;
            let dstPos      = Vector3.create( (this.player_pos.x - 15) * this.tile_size ,1, (-this.player_pos.z + 15 ) * this.tile_size );
            
            if  ( direction == -1 ) {
                dstPos.x -= this.tile_size;
                
            } else if ( direction == -32 ) {
                dstPos.z += this.tile_size;

            } else if ( direction == 1 ) {
                dstPos.x += this.tile_size;

            } else if ( direction == 32 ) {
                dstPos.z -= this.tile_size;
            }
            delete this.movables[ tilecoord ];
            this.movables[ tilecoord + direction ] = [ tile, tiletype , 0 , srcPos, dstPos ] ;

            this.check_movable_block_current_tile( tilecoord + direction, tilecoord );
            resources["index"].play_sound("stone");
            
        }
    }

    

    //-----
    get_y_rot_by_direction( direction ) {
        if ( direction == -1 ) {
            return -90;
        } else if ( direction == -32 ) {
            return 0;
        } else if ( direction == 1 ) {
            return 90
        } else if ( direction == 32 ) {
            return 180
        }
    }

    //--------
    move_player(  direction ) {

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
            this.player_stats[3] = this.player_tilecoord_to_position( cur_tilecoord );
            this.player_stats[4] = this.player_tilecoord_to_position( new_tilecoord );
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
    // BOOKMARK glb_block
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

        if ( tile_type == 33 ) {
            src = 'models/block_white_edge.glb';
        } else if ( tile_type == 37 ) {
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
            src = 'models/brownbutton.glb';
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
        
        } else if ( tile_type == 70 ) {
            src = 'models/boot_flipper.glb'

        } else if ( tile_type == 71 ) {
            src = 'models/boot_fire.glb'
        } else if ( tile_type == 72 ) {
            src = 'models/boot_suction.glb'
        } else if ( tile_type == 73 ) {
            src = 'models/boot_skates.glb'
        
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
        Material.setPbrMaterial(tile, {
            albedoColor: color,
            metallic: 0,
            roughness: 1,
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
            metallic: metallic,
            roughness: roughness,
        })
        return tile;
    }


    

    //------
    create_textured_block( x, y, z , src, frame_x, frame_y, x_frames, y_frames, height, size ) {

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

        Material.setBasicMaterial( tile , {
            texture: Material.Texture.Common({
                src: src ,
            }),
            
        })
        return tile;
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

        this.create_explosions(
            Transform.getMutable( this.player ).position.x, 
            Transform.getMutable( this.player ).position.y + 1, 
            Transform.getMutable( this.player ).position.z, 
            1.0             
        );
    }


    //------
    create_explosions_on_tile( tilecoord ) {
        
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
    player_tilecoord_to_position( tilecoord ):Vector3 {

        let tile_x = tilecoord % 32;
        let tile_z = ( tilecoord / 32 ) >> 0;
        let x = (  tile_x - 15 ) * this.tile_size  ;
        let z = ( -tile_z + 15 ) * this.tile_size  ;
        let y =  0.5;

        return Vector3.create( x, y, z );
        
    }

    


    //-------
    gameover() {
        resources["index"].play_sound( "scream" );
        resources["ui"]["bgmask"].visible = "flex";
        this.game_state = 2;
        Animator.playSingleAnimation( this.player , 'idle', false )

    }




    //---
    restart_level() {

        this.game_state = 0;    
        resources["ui"]["bgmask"].visible = "none";

        for ( let i = 0 ; i < 8 ; i++ ) {
            resources["ui"]["inventory"]["items"][i].visible = "none";
            resources["ui"]["inventory"]["items"][i].count_lbl   = "";
            resources["ui"]["inventory"]["items"][i].count      = 0;
        }


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

        // Blue wall 
        for ( let tilecoord in this.removables ) {
            if ( this.removables[tilecoord][1] == 9 ) {
                let tile = this.removables[ tilecoord ][0];
                Material.setPbrMaterial(tile, {
                    albedoColor: Color4.fromInts(120,120,200,255),
                    metallic: 0,
                    roughness: 1,
                })
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
                    
                    if ( layers[ly].name == "bg" ) {



                        if ( layers[ly].data[i] == 33 ) {

                            // 33: standard floor
                            this.create_glb_block( 
                                (x_tile - 15 ) * this.tile_size,
                                0, 
                                (-z_tile + 15 ) * this.tile_size, 
                                layers[ly].data[i],
                                1,
                                1,
                            );

                        } else if ( layers[ly].data[i] == 34 ) {

                            // 34: exit
                             
                            this.create_textured_block_emissive( 
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


                        } else if ( layers[ly].data[i] >= 39 && layers[ly].data[i] <= 42  ) {

                            // 39-42: Force floor
                            this.create_textured_block_emissive( 
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


                        } else if ( layers[ly].data[i] >= 43 && layers[ly].data[i] <= 47  ) {

                            // 43-47: Ice floor
                            this.create_glb_block( 
                                (x_tile - 15 ) * this.tile_size,
                                0, 
                                (-z_tile + 15 ) * this.tile_size,
                                layers[ly].data[i],
                                1,
                                1
                            )
                            
                        }

                    
                    } else if ( layers[ly].name == "fg" ) {

                        if ( layers[ly].data[i] == 1 ) {

                            // 1: standard wall
                            this.create_glb_block( 
                                (x_tile - 15 ) * this.tile_size,
                                1, 
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
                        // 81 : brown button creation
                        // 84 ：teleport creation
                        // 52 : trap  creation
                        // 129: thief creation
                        

                        // Textured blocks:
                        // 50,51: Toggle door creation
                        // 53 : recessed wall creation.
                        //  8 : clone machine  creation

                        
                        let static_textured_blocks          = [ 50,51,53, 8];
                        let static_textured_blocks_index    = static_textured_blocks.indexOf( layers[ly].data[i] );
                        
                        let static_glbs         = [ 48,49, 80, 81, 84, 52, 129];
                        let static_glbs_index   = static_glbs.indexOf( layers[ly].data[i] );
                            

                        
                        // 50,51,53 : The indicator 
                        if ( static_textured_blocks_index > -1 ) {

                            let frame_x = 2;
                            if ( layers[ly].data[i] == 8 ) {
                                frame_x = 4;
                            }

                            this.create_textured_block_emissive( 

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
                            this.create_glb_block( 
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

                    } 
                }


            } else if ( ["object"].indexOf( layers[ly].name ) > -1 ) {
                
                for ( let i = 0 ; i < layers[ly].objects.length ; i++ ) {
                    let obj = layers[ly].objects[i];
                    if ( obj.type == "switch" ) {
                        let properties = {};
                        for ( let j = 0 ; j < obj.properties.length ; j++ ) {
                            properties[ obj.properties[j].name ] = obj.properties[j].value;
                        }
                        this.src_and_target[ properties["tile_y"] * 32 + properties["tile_x"] ] = properties["target_tile_y"] * 32 + properties["target_tile_x"];
                        
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

            if ( ["fg","item","removable","monster"].indexOf( layers[ly].name ) > -1 ) {

                for ( let i = 0 ; i < layers[ly].data.length ; i++ ) {

                    let x_tile = i % 32;
                    let z_tile =  (i / 32) >> 0 ;
                    

                    //-------------------------------
                    // removable layer
                    if ( layers[ly].name == "removable" ) {

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

                        
                        // 37: water creation
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
                        // 6 socket creation
                        } else if ( layers[ly].data[i] >= 2 && layers[ly].data[i] <= 6 ) {
                            
                            if ( this.removables[ i ] == null ) {

                                // padlock wall refill
                                let frame_x = 0;
                                let frame_y = 15;
                                if ( layers[ly].data[i] == 6 ) {
                                    frame_x = 0;
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

                        // 7: movable brown wall creation
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
                        
                        // 9,10 blue wall creation
                        } else if ( [9,10].indexOf( layers[ly].data[i] ) > -1  ) {
                            
                            if ( this.removables[ i ] == null ) {

                                let tile = this.create_colored_block( 
                                    (x_tile - 15 ) * this.tile_size,
                                    1, 
                                    (-z_tile + 15 ) * this.tile_size, 
                                    Color4.fromInts(120,120,200,255),
                                    1,
                                    1
                                );
                                this.removables[ i ] = [ tile ,  layers[ly].data[i]  ];

                            }
                        
                        
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

                                let tile = this.create_glb_block( 
                                    (x_tile - 15 ) * this.tile_size,
                                    y, 
                                    (-z_tile + 15 ) * this.tile_size, 
                                    layers[ly].data[i],
                                    1,
                                    0.8
                                );
                                this.togglables[i] = [ tile, layers[ly].data[i] , status ];


                            }    

                        
                        }




                    } else if ( layers[ly].name == "monster" ) {
                        
                        // Monsters
                        // 97 bug creation
                        // 98 tank creation
                        // 100 glider creation
                        // 101 fireball creation
                        // 102 pink ball creation

                        let static_glbs = [ 97 , 98, 100, 101 , 102 ];
                        let static_glbs_index = static_glbs.indexOf( layers[ly].data[i] ) 
                        let sizes = [ 0.5, 0.9 , 0.9 , 1 , 0.7 ]
                        let ys     = [ 0.6, 0.7, 1.2 , 0.6, 0.6 ]

                        if ( static_glbs_index > -1  ) {

                            let size = sizes[ static_glbs_index ];
                            let y    = ys[ static_glbs_index];

                            if ( this.monsters[ i ] == null ) {
                                let tile = this.create_glb_block( 
                                    (x_tile - 15 ) * this.tile_size,
                                    y, 
                                    (-z_tile + 15 ) * this.tile_size,
                                    layers[ly].data[i],
                                    size,
                                    size
                                );
                                this.monsters[i] = [ tile, layers[ly].data[i] ];
                                this.monsters_next_move(i);
                            }
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
    monsters_next_move( tilecoord ) {

        if ( this.monsters[ tilecoord ] ) {

            let monster = this.monsters[tilecoord];

            //   0     1            2     3    4      5      6
            // tile,type,lerp_progress,start,end,isdead, head direction
            if ( monster ) {


                if ( monster[6] == null ) {
                    if ( monster[1] == 102 || monster[1] == 101 ) {
                        monster[6] = -1;
                    } else {
                        monster[6] = -32;
                    }
                }

                let s_tile_x = tilecoord % 32;
                let s_tile_z = (tilecoord / 32) >> 0;
                let sx = ( s_tile_x - 15 ) * this.tile_size;
                let sy = Transform.getMutable( monster[0] ).position.y; 
                let sz = (-s_tile_z + 15 ) * this.tile_size;
                let e_tilecoord = tilecoord;
                

                //--------------------------------
                // 97 bugs
                if ( monster[1] == 97 ) {

                    let left_direction = this.get_left_direction( monster[6] );
                    if ( this.check_is_tile_passable_for_monster(  tilecoord + left_direction, monster[1] , left_direction ) == true ) {

                        // left
                        e_tilecoord = tilecoord + left_direction;
                        monster[6] = left_direction;
                        
                    } else if ( this.check_is_tile_passable_for_monster( tilecoord + monster[6], monster[1] , monster[6] ) == true ) {

                        // Up
                        e_tilecoord = tilecoord + monster[6];
                        
                    } else if ( this.check_is_tile_passable_for_monster( tilecoord - left_direction , monster[1], -left_direction ) == true ) {
                        
                        // right
                        e_tilecoord = tilecoord - left_direction;
                        monster[6] = -left_direction;
                    
                    } else if ( this.check_is_tile_passable_for_monster( tilecoord - monster[6], monster[1] , monster[6] ) == true ) {

                        // down
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

                    let left_direction = this.get_left_direction( monster[6] );
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

                    let left_direction = this.get_left_direction( monster[6] );
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
                    monster[8] = 0.08;

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
                }

                let e_tile_x = e_tilecoord % 32;
                let e_tile_z = ( e_tilecoord / 32)  >> 0;
                let ex = ( e_tile_x - 15 ) * this.tile_size;
                let ey = sy; 
                let ez = (-e_tile_z + 15 ) * this.tile_size;
                
                monster[2] = 0;
                monster[3] = Vector3.create( sx, sy, sz );
                monster[4] = Vector3.create( ex, ey, ez );
                monster[7] = e_tilecoord;

            }
        }
    }

    

    //------------

    update( dt ) {

        let _this = resources["stage"];


        if ( _this.game_state == 0 ) {

            // player
            if ( _this.player_stats[2] != null ) {
                
                let progress = _this.player_stats[2];
                let start    = _this.player_stats[3];
                let end      = _this.player_stats[4];
                let direction = _this.player_stats[6];
                let speed     = _this.player_stats[8]; 
                
                
                _this.player_stats[2] += speed;
                

                let cur_tilecoord   = _this.player_pos.z * 32 + _this.player_pos.x;
                let new_tilecoord   = _this.player_stats[7];

                Transform.getMutable( _this.player ).position = Vector3.lerp( start, end , progress);
                Transform.getMutable( _this.player ).rotation = Quaternion.fromEulerDegrees( 0 , _this.get_y_rot_by_direction( direction), 0 );

                Animator.playSingleAnimation( _this.player , 'walk', false )

                // BOOKMARK UPDATE PLAYER

                // If to be entered tile is not ice or force floor, then can start check_player_current_tile() at lerp progress 0.5
                //  otherwise, we only do it at lerp progress of 0.99 for smoother animation.
                //   The reason for doing early at 0.5 is because when pushing block or encountering monster,
                //      the player doesn't need to wait until the full tile is entered.

                let passed_tile_lerp_threshold = 0.5;
                if ( _this.current_level_obj[ _this.current_level_obj_index["bg"] ].data[new_tilecoord] >= 39 && 
                     _this.current_level_obj[ _this.current_level_obj_index["bg"] ].data[new_tilecoord] <= 47 ) {
                    passed_tile_lerp_threshold = 0.99;
                }


                if ( _this.player_stats[2] >= passed_tile_lerp_threshold && _this.player_stats[10] == null ) {

                    _this.player_stats[10] = 1;
                    _this.player_pos.x =   new_tilecoord % 32;
                    _this.player_pos.z = ( new_tilecoord / 32 ) >> 0;  
                    _this.pickup_items();
                    _this.check_player_current_tile( cur_tilecoord );
                    _this.push_movable_block( direction );
                }   
                
                if (  _this.player_stats[2] >= 0.99 ) {
                
                    

                    _this.player_stats[2] = null;
                    _this.player_align_avatar_to_player_pos_tilecoord();
                    _this.player_stats[10] = null;
                   
                }
            } 

                let has_down = 0;
                if ( resources["button_states"][InputAction.IA_LEFT] == 1 ) {

                    Transform.getMutable( _this.player ).rotation = Quaternion.fromEulerDegrees( 0 , -90, 0 );
                    _this.move_player(-1);
                    has_down = 1;
                        

                } else if (resources["button_states"][InputAction.IA_FORWARD] == 1 ) { 
                    Transform.getMutable( _this.player ).rotation = Quaternion.fromEulerDegrees( 0 , 0, 0 );
                    _this.move_player(-32);
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
            for ( let tilecoord in _this.movables ) {
                
                if ( _this.movables[tilecoord][2] != null ) {
                    
                    _this.movables[tilecoord][2] += 0.1;
                    let tile = _this.movables[tilecoord][0];
                    let progress = _this.movables[tilecoord][2];  
                    let start = _this.movables[tilecoord][3];
                    let end = _this.movables[tilecoord][4];
                    
                    Transform.getMutable( tile ).position = Vector3.lerp( start, end, progress );
                    
                    // BOOKMARK UPDATE MOVABLE BLOCKS

                    if ( _this.movables[tilecoord][2] >= 0.99 ) {

                        _this.movables[tilecoord][2] = null ;

                        if ( _this.movables[tilecoord][5] == 1 || _this.movables[tilecoord][5] == 2 ) {
                            

                            // 2 is specifically for dropping movable block into water.
                            if ( _this.movables[tilecoord][5] == 2 ) {

                                // remove water 
                                if ( _this.removables[ tilecoord ] ) {
                                    let water_tile = _this.removables[tilecoord ][0];
                                    engine.removeEntity( water_tile );
                                    delete _this.removables[tilecoord];

                                }
                                resources["index"].play_sound("water");

                                // Create dirt 
                                // 11: Dirt
                                let tile = _this.create_colored_block(
                                    end.x,
                                    0.1,
                                    end.z,
                                    Color4.fromInts(100,80,40,255),
                                    1,
                                    1
                                );
                                _this.creatables[ tilecoord ] = [ tile , 11 ];

                            }

                            // Remove movable block
                            engine.removeEntity( _this.movables[tilecoord][0] );
                            delete _this.movables[tilecoord];
                            
                        }
                    }
                }
            }

            // Monster
            for ( let tilecoord in _this.monsters ) {

                let tile            = _this.monsters[tilecoord][0];
                let type            = _this.monsters[tilecoord][1];
                let progress        = _this.monsters[tilecoord][2];    
                let start           = _this.monsters[tilecoord][3];
                let end             = _this.monsters[tilecoord][4];
                let direction       = _this.monsters[tilecoord][6];
                let new_tilecoord   = _this.monsters[tilecoord][7];
                let speed           = _this.monsters[tilecoord][8];
                let is_trapped      = _this.monsters[tilecoord][9];

                if ( speed == null ) {
                    speed = 0.05;
                }

                let is_on_clone_machine = 0;
                if ( _this.current_level_obj[ _this.current_level_obj_index["item"] ].data[ tilecoord ] == 8 ) {
                    is_on_clone_machine = 1;
                }

                // 97 bug, 
                // 98 bluetank
                // 100 glider
                // 101 fireball
                // 102 pink ball
                if ( [ 97, 98, 100, 101, 102 ].indexOf( type ) > -1 ) {

                    if ( is_trapped != 1 && is_on_clone_machine != 1 ) {

                        _this.monsters[tilecoord][2] += speed;
                        Transform.getMutable( tile ).position = Vector3.lerp( start, end, progress );
                        Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees( 0 , _this.get_y_rot_by_direction(direction) , 0 );
                        
                        if ( progress <= 0.5 ) {
                            // if slerp progress <50% the monster is counted as still at current tile.
                            if ( _this.player_pos.z * 32 + _this.player_pos.x == tilecoord ) {
                                _this.gameover();
                            }
                        } else {
                            // if slerp progress >50 the monster is counted as at the destination tile
                            if ( _this.player_pos.z * 32 + _this.player_pos.x == new_tilecoord ) {
                                _this.gameover();
                            }
                            
                        }

                        if ( _this.monsters[tilecoord][2] >= 0.99 ) {
                            
                            
                            // Only generate next move if not trapped.
                            delete _this.monsters[tilecoord];
                            _this.monsters[new_tilecoord] = [ tile, type , null, null, null, null, direction ];
                            _this.monsters_next_move( new_tilecoord );
                            _this.check_monster_current_tile(  new_tilecoord );
                            
                        }
                    }
                        
                    

                } 
                
            }
        } // game state == 0

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

