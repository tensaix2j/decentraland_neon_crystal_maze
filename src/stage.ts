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
    TextureWrapMode
} from '@dcl/sdk/ecs'


import level01 from "./levels/level01";
import level02 from "./levels/level02";
import level03 from "./levels/level03";
import level04 from "./levels/level04";

import resources from "./resources";


//-------------------
export class Stage {

    public root;
    public tile_size = 1.05;
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

    
    public current_level_obj_index = {};
    public game_state = 0;


    //-----------------
    constructor( aPos )  {

        let root = engine.addEntity();
        Transform.create( root, {
            position: aPos 
        });
        this.root = root;
        this.create_player();
        this.load_level( level04.layers );
        engine.addSystem( this.update );
        

    }


    //--------
    open_lock_if_bump_into_one( tilecoord ) {
        
        let tile_x = tilecoord % 32;
        let tile_z = ( tilecoord / 32 ) >> 0;
        if ( this.removables[ tilecoord ] != null ) {
            
            let tile    = this.removables[ tilecoord ][0];
            let item_id = this.removables[ tilecoord ][1];

            // Is colored padlock
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
            } else if ( item_id == 6 ) {
                // socket
                // remaining chip is 0
                if ( resources["ui"]["gamestatus"].chip_remaining <= 0 ) {

                    resources["index"].play_sound("switch");
                    engine.removeEntity( tile );
                    delete this.removables[ tilecoord ];
                    
                }   
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
            resources["index"].play_sound( "correct" );
            
            if ( item_id >= 66 && item_id <= 73 ) {

                let inventory_id = item_id - 66;
                resources["ui"]["inventory"]["items"][ inventory_id ].count += 1;
                resources["ui"]["inventory"]["items"][ inventory_id ].visible = "flex";
                if ( resources["ui"]["inventory"]["items"][ inventory_id ].count > 1 ) {
                    resources["ui"]["inventory"]["items"][ inventory_id ].count_lbl = resources["ui"]["inventory"]["items"][ inventory_id ].count + ""  ;
                }
            } else if ( item_id == 65 ) {
                
                resources["ui"]["gamestatus"].chip_remaining -= 1;
                
            }
        }
    }


    //--------
    check_player_current_tile(  prev_tilecoord ) {
        
        let tilecoord       = this.player_pos.z * 32 + this.player_pos.x ;
        let tile_data_bg    = this.current_level_obj[ this.current_level_obj_index["bg"] ].data[ tilecoord ];
        let tile_data_item  = this.current_level_obj[ this.current_level_obj_index["item"] ].data[ tilecoord ];
        // 37 Water.
        if ( this.removables[ tilecoord ] && this.removables[ tilecoord ][1] == 37 && this.removables[tilecoord][5] == null ) {
            
            let inventory_id = 4; 
            // has water boot
            if ( resources["ui"]["inventory"]["items"][inventory_id].count > 0 ) {
                // survive
            } else {
        
                // Water trap
                resources["index"].play_sound("water");
                this.gameover();
                Transform.getMutable(this.player).position.y = Transform.getMutable( this.root ).position.y + 0.8  - 1.0;
            }
        }

        // 39-42 Force floor
        
        // 39: left , 40: up , 41: right  , 42: down
        if ( tile_data_bg >= 39 && tile_data_bg <= 42  ) {

            let inventory_id = 6;
            // has force floor boot
            if ( resources["ui"]["inventory"]["items"][inventory_id].count > 0 ) {
                // survive
            } else {
                let direction     = [-1,-32,1,32][ tile_data_bg - 39 ];
                let new_tilecoord = tilecoord + direction;
                
                // for consistency with monster,  2: progress, 6:direction, 7: new_tilecoord
                this.player_stats[2] = 0;
                this.player_stats[6] = direction 
                this.player_stats[7] = new_tilecoord;
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
                this.player_stats[6] = direction 
                this.player_stats[7] = new_tilecoord;
            }
        }

        //48 Blue switch,
        if ( tile_data_item == 48 ) {
            
            for ( let tilecoord in this.monsters ) {
                if ( this.monsters[tilecoord] && this.monsters[tilecoord][1] == 98 ) {
                    this.monsters[ tilecoord ][6] = -this.monsters[ tilecoord ][6];
                }
            }
        }

        //49 Green switch
        if ( tile_data_item == 49 ) {
            
            console.log("AAA");
            for ( let tilecoord in this.togglables ) {

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


    //-------
    check_is_tile_passable_for_monster( tilecoord ) {

        let ret = true;
         // standard wall (1) 
         if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord  ] == 1  )  {
            ret = false;
        }

        // lockpad (2-5) and socket(6)
        if ( this.removables[ tilecoord  ] && 
             this.removables[ tilecoord ][1] >= 2 && this.removables[ tilecoord ][1] <= 6  )  {
            ret = false;
            
        }
        // Movable blocks (7), if there's a movable block, check if pushable or not.
        if ( this.movables[ tilecoord ] ) {
            ret = false;
        }
        return ret;
    }




    //-------
    check_is_tile_passable( tilecoord , direction ) {

        let ret = true;
        
        // standard wall (1) 
        if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord  ] == 1  )  {
            ret = false;
        }

        // lockpad (2-5) and socket(6)
        if ( this.removables[ tilecoord  ] && 
             this.removables[ tilecoord ][1] >= 2 && this.removables[ tilecoord ][1] <= 6  )  {
            ret = false;
            
        }

        // togglable wall
        if ( this.togglables[ tilecoord  ] && 
            this.togglables[ tilecoord ][2] == 1  )  {
           ret = false;
           
       }
        // Movable blocks (7), if there's a movable block, check if pushable or not.
        if ( this.movables[ tilecoord ] ) {

            if ( direction != 0 ) {
                if ( this.check_is_tile_passable( tilecoord + direction , 0 ) == true ) {
                    // Can push into
                    ret = true;
                } else {
                    // Cannot push into
                    ret = false;
                }
            } else {
                // Recursive call base case
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

            this.check_movable_block( tilecoord + direction );

            
        }
    }

    //----
    check_movable_block( tilecoord ) {

        // Check movable block if dropped to water.
        if ( this.movables[ tilecoord ] ) {

            if ( this.removables[ tilecoord ] && this.removables[ tilecoord ][1] == 37  ) {
                
                // Mark to delete upon animation completes
                this.movables[ tilecoord ][5] = 2; 
                
                // mark the water inactive
                this.removables[ tilecoord ][5] = 2;
                
            }
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
        let new_tilecoord       = ( this.player_pos.z * 32 + this.player_pos.x ) + direction;
        if ( this.check_is_tile_passable( new_tilecoord , direction ) == true ) {
                
            if ( direction == -1 ) {
                this.player_pos.x -= 1;
                Transform.getMutable( this.player ).position.x -= this.tile_size;
                Transform.getMutable( this.player ).rotation = Quaternion.fromEulerDegrees(0,-90,0);

            } else if ( direction == -32 ) {
                this.player_pos.z -= 1;
                Transform.getMutable( this.player ).position.z += this.tile_size;
                Transform.getMutable( this.player ).rotation = Quaternion.fromEulerDegrees(0, 0,0);

            } else if ( direction == 1 ) {
                this.player_pos.x += 1;
                Transform.getMutable( this.player ).position.x += this.tile_size;
                Transform.getMutable( this.player ).rotation = Quaternion.fromEulerDegrees(0, 90,0);

            } else if ( direction == 32 ) {
                this.player_pos.z += 1;
                Transform.getMutable( this.player ).position.z -= this.tile_size;
                Transform.getMutable( this.player ).rotation = Quaternion.fromEulerDegrees(0, 180,0);

            }

        } else {
            this.open_lock_if_bump_into_one( new_tilecoord );
        }

        //console.log( "Player current tile", this.player_pos.x, this.player_pos.z );
        this.pickup_items();
        this.check_player_current_tile( cur_tilecoord );
        this.push_movable_block( direction );
        
    }

    

    //---------
    create_player() {

        let player = engine.addEntity();
        AvatarShape.create(player, {
            id : '',
            emotes: [],
            wearables: [],  
            name: "Player"
        })

        Transform.create( player, {
            
            // Some unknown bug that it doesn't always follow the parent position.
            //  might as well not use the parent.
            //parent: this.root,
            
            position: Vector3.create(
                Transform.getMutable( this.root ).position.x ,
                Transform.getMutable( this.root ).position.y + 0.8 ,
                Transform.getMutable( this.root ).position.z,
            ),
            scale: Vector3.create( 
                0.65 , 0.65 , 0.65
            )
            
        })
        this.player = player;
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
    create_textured_block( x, y, z , frame_x, frame_y, height) {

        let tile = engine.addEntity();
        Transform.create( tile , {
            parent: this.root,
            position: { 
                x: x,  
                y: y, 
                z: z
            },
            scale: {
                x: 1,  y: height, z: 1
            }
        });

        
        MeshRenderer.setBox(tile, [
            
            // T
            (frame_x )/32             , (frame_y+1) / 32,
            (frame_x + 1)/32        , (frame_y+1) / 32,
            (frame_x + 1 )/32     , frame_y / 32,
            (frame_x )/32             , frame_y / 32,
            
            (frame_x )/32             , frame_y / 32,
            (frame_x + 1 )/32     , frame_y / 32,
            (frame_x + 1)/32        , (frame_y+1) / 32,
            (frame_x )/32             , (frame_y+1) / 32,
            
            // L
            (frame_x )/32             , (frame_y+1) / 32,
            (frame_x + 1)/32        , (frame_y+1) / 32,
            (frame_x + 1 )/32     , frame_y / 32,
            (frame_x )/32             , frame_y / 32,
            
            // R
            (frame_x + 1)/32        , (frame_y+1) / 32,
            (frame_x )/32             , (frame_y+1) / 32,
            (frame_x )/32             , frame_y / 32,
            (frame_x + 1 )/32     , frame_y / 32,
            
            (frame_x + 1 )/32     , frame_y / 32,
            (frame_x + 1)/32        , (frame_y+1) / 32,
            (frame_x )/32             , (frame_y+1) / 32,
            (frame_x )/32             , frame_y / 32,
            
            // F
            (frame_x )/32             , (frame_y+1) / 32,
            (frame_x + 1)/32        , (frame_y+1) / 32,
            (frame_x + 1 )/32     , frame_y / 32,
            (frame_x )/32             , frame_y / 32,
            
        ]);

       

        Material.setBasicMaterial( tile , {
            texture: Material.Texture.Common({
                src: "images/tileset.png",
            }),
            
        })
        return tile;

    }




    //------
    create_item_plane( x, y, z , frame_x, frame_y, size ) {

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
        Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees( 90, 0 , 0 );
        
        MeshRenderer.setPlane(tile, [
            
            // T
            (frame_x )/32               , frame_y / 32,
            (frame_x )/32               , (frame_y+1) / 32,
            (frame_x + 1)/32            , (frame_y+1) / 32,
            (frame_x + 1 )/32           , frame_y / 32,
            
            // B
            (frame_x )/32               , frame_y / 32,
            (frame_x )/32               , (frame_y+1) / 32,
            (frame_x + 1)/32            , (frame_y+1) / 32,
            (frame_x + 1 )/32           , frame_y / 32,
            
        ]);
        
        

        Material.setBasicMaterial( tile , {
            texture: Material.Texture.Common({
                src: "images/tileset.png",
            }),
            
        })
        return tile
    }

    //---------
    player_align_avatar_to_player_pos_tilecoord() {

        Transform.getMutable( this.player ).position.x = (  this.player_pos.x - 15 ) * this.tile_size + Transform.getMutable( this.root ).position.x ;
        Transform.getMutable( this.player ).position.z = ( -this.player_pos.z + 15 ) * this.tile_size + Transform.getMutable( this.root ).position.z ;
        Transform.getMutable( this.player ).position.y =                                                Transform.getMutable( this.root ).position.y + 0.8 ;

    }

    //-----------
    // this loads objects that can be reset.
    load_dynamic_objects( layers ) {

        
        for ( let ly = 0 ; ly < layers.length ; ly++ ) {
            for ( let i = 0 ; i < layers[ly].data.length ; i++ ) {

                let x_tile = i % 32;
                let z_tile =  (i / 32) >> 0 ;



                //-------------------------------bg layer
                if ( layers[ly].name == "bg" ) {

                    if ( layers[ly].data[i] == 37 ) {

                        if ( this.removables[ i ] == null ) {
                            
                            // water
                            let tile = this.create_textured_block( 
                                (x_tile - 15 ) * this.tile_size,
                                0, 
                                (-z_tile + 15 ) * this.tile_size, 
                                4,
                                30,
                                1
                            );
                            this.removables[ i ] = [ tile, layers[ly].data[i] ];
                        }
                    }


                //-------------------------------fg layer    
                } else if ( layers[ly].name == "fg" ) {

                    if ( layers[ly].data[i] >= 2 && layers[ly].data[i] <= 6 ) {
                        
                        if ( this.removables[ i ] == null ) {

                            // padlock wall refill
                            let tile = this.create_textured_block( 
                                (x_tile - 15 ) * this.tile_size,
                                1, 
                                (-z_tile + 15 ) * this.tile_size, 
                                1 + layers[ly].data[i] - 2,
                                31,
                                1
                            );
                            this.removables[ i ] = [ tile, layers[ly].data[i] ];
                        }


                    } else if ( layers[ly].data[i] == 7 ) {

                        if ( this.movables[ i ] == null ) {
                            
                            // movable wall
                            let tile = this.create_colored_block( 
                                (x_tile - 15 ) * this.tile_size,
                                1, 
                                (-z_tile + 15 ) * this.tile_size, 
                                Color4.fromInts(180,150,120,255),
                                1,
                                1
                            );

                            this.movables[ i ] = [ tile , 7 ];

                        }
                    } 



                
                //------------------------------- item layer
                } else if ( layers[ly].name == "item" ) {

                    if ( layers[ly].data[i] == 35 ) {
                        
                        // Player starting tile
                        this.player_pos.x = x_tile ;
                        this.player_pos.z = z_tile ;
                        this.player_align_avatar_to_player_pos_tilecoord()



                    // keys (66,67,68,69) and chip (65)
                    // shoes (70,71,72,73)
                    } else if ( layers[ly].data[i] >= 65 && layers[ly].data[i] <= 73 
                        ) {

                        if ( this.pickables[ i ] == null ) {

                            let tile = this.create_item_plane( 
                                (x_tile - 15 ) * this.tile_size,
                                1, 
                                (-z_tile + 15 ) * this.tile_size, 
                                layers[ly].data[i] - 65,
                                29,
                                0.8
                            );
                                
                            this.pickables[ i ] = [ tile, layers[ly].data[i] ];


                            // Chip
                            if ( layers[ly].data[i] == 65 ) {
                                resources["ui"]["gamestatus"].chip_remaining += 1;
                            }
                        }

                    // monsters
                    } else if ( layers[ly].data[i] >= 97 && layers[ly].data[i] <= 98 ) {

                        if ( this.monsters[ i ] == null ) {
                        
                            let tile = this.create_item_plane( 
                                (x_tile - 15 ) * this.tile_size,
                                0.6, 
                                (-z_tile + 15 ) * this.tile_size, 
                                layers[ly].data[i] - 97,
                                28,
                                0.8
                            );
                            this.monsters[i] = [ tile, layers[ly].data[i] ];
                            this.monsters_next_move(i);

                        }
                    

                    // fire
                    } else if ( layers[ly].data[i] == 38 ) {

                        if ( this.monsters[ i ] == null ) {

                           
                            let tile = this.create_item_plane( 
                                (x_tile - 15 ) * this.tile_size,
                                1, 
                                (-z_tile + 15 ) * this.tile_size, 
                                5,
                                30,
                                0.8
                            );
                            this.monsters[i] = [ tile, layers[ly].data[i] ];
                            
                        }
                    } else if ( layers[ly].data[i] >= 50 &&  layers[ly].data[i] <= 51 ) {

                        // toggle door
                        if ( this.togglables[ i ] == null ) {

                            let status  = layers[ly].data[i] - 50;
                            let y       = [ -2,1 ][status] 

                            let tile = this.create_colored_block( 
                                (x_tile - 15 ) * this.tile_size,
                                y, 
                                (-z_tile + 15 ) * this.tile_size, 
                                Color4.fromInts(120,120,120,255),
                                1,
                                0.8
                            );
                            this.togglables[i] = [ tile, layers[ly].data[i] , status ];


                        }
                    }   
                    

                }

            }
        }
    }



    //-------
    gameover() {
        
        resources["ui"]["bgmask"].visible = "flex";
        this.game_state = 2;

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

        // monster
        for ( let tilecoord in this.monsters ) {
            let tile = this.monsters[tilecoord][0];
            engine.removeEntity( tile );
            delete this.monsters[tilecoord];
        }


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
            for ( let i = 0 ; i < layers[ly].data.length ; i++ ) {

                let x_tile = i % 32;
                let z_tile =  (i / 32) >> 0 ;
                
                if ( layers[ly].name == "bg" ) {



                    if ( layers[ly].data[i] == 33 ) {

                        // white floor
                        this.create_colored_block( 
                            (x_tile - 15 ) * this.tile_size,
                            0, 
                            (-z_tile + 15 ) * this.tile_size, 
                            Color4.fromInts(200,200,200,255) ,
                            1,
                            1
                        );

                    } else if ( layers[ly].data[i] == 34 ) {

                        // exit
                        this.create_textured_block( 
                            (x_tile - 15 ) * this.tile_size,
                            0, 
                            (-z_tile + 15 ) * this.tile_size, 
                            1,
                            30,
                            1
                        );


                    } else if ( layers[ly].data[i] >= 39 && layers[ly].data[i] <= 42  ) {

                        // Force floor
                        this.create_textured_block( 
                            (x_tile - 15 ) * this.tile_size,
                            0, 
                            (-z_tile + 15 ) * this.tile_size, 
                            layers[ly].data[i] - 39 + 6,
                            30,
                            1
                        );


                    } else if ( layers[ly].data[i] >= 43 && layers[ly].data[i] <= 47  ) {

                        // Ice floor
                        this.create_textured_block( 
                            (x_tile - 15 ) * this.tile_size,
                            0, 
                            (-z_tile + 15 ) * this.tile_size, 
                            layers[ly].data[i] - 43 + 10,
                            30,
                            1
                        );
                    }

                
                } else if ( layers[ly].name == "fg" ) {

                    if ( layers[ly].data[i] == 1 ) {

                        // grey wall
                        this.create_colored_block( 
                            (x_tile - 15 ) * this.tile_size,
                            1, 
                            (-z_tile + 15 ) * this.tile_size, 
                            Color4.fromInts(120,120,120,255),
                            1,
                            1
                        );

                    
                    }
                } else if ( layers[ly].name == "item" ) {

                    // 48 :blue switch,
                    // 49 : green switch,
                    if ( layers[ly].data[i] >= 48 && layers[ly].data[i] <= 49 ) {

                        this.create_item_plane( 
                            (x_tile - 15 ) * this.tile_size,
                            0.6, 
                            (-z_tile + 15 ) * this.tile_size, 
                            layers[ly].data[i] - 48 + 15,
                            30,
                            1.0
                        );
                    

                    // 50,51 Toggle door
                    } else if ( layers[ly].data[i] >= 50 && layers[ly].data[i] <= 51  ) {
                        
                        // Only the frame is static
                        this.create_item_plane( 
                            (x_tile - 15 ) * this.tile_size,
                            0.52, 
                            (-z_tile + 15 ) * this.tile_size, 
                            17,
                            30,
                            1.0
                        );

                        // The door itself is in load_dynamic_object function
                        
                    }

                }
            }
            
        }
        this.load_dynamic_objects( layers );

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
                    monster[6] = -32;
                }

                let s_tile_x = tilecoord % 32;
                let s_tile_z = (tilecoord / 32) >> 0;
                let sx = ( s_tile_x - 15 ) * this.tile_size;
                let sy = 0.6; 
                let sz = (-s_tile_z + 15 ) * this.tile_size;
                let e_tilecoord = tilecoord;
                

                //--------------------------------
                if ( monster[1] == 97 ) {

                    // 97: Bugs
                    let left_direction = this.get_left_direction( monster[6] );
                    if ( this.check_is_tile_passable_for_monster( tilecoord + left_direction ) == true ) {

                        // left
                        e_tilecoord = tilecoord + left_direction;
                        monster[6] = left_direction;
                        
                    } else if ( this.check_is_tile_passable_for_monster( tilecoord + monster[6] ) == true ) {

                        // Up
                        e_tilecoord = tilecoord + monster[6];
                        
                    } else if ( this.check_is_tile_passable_for_monster( tilecoord - left_direction ) == true ) {
                        
                        // right
                        e_tilecoord = tilecoord - left_direction;
                        monster[6] = -left_direction;
                    
                    } else if ( this.check_is_tile_passable_for_monster( tilecoord - monster[6] ) == true ) {

                        // down
                        e_tilecoord = tilecoord - monster[6];
                        monster[6] = -monster[6];
                    }
                    


                //--------------------------------
                } else if ( monster[1] == 98 )  {

                    
                    // Blue tank  
                    e_tilecoord = tilecoord;
                    if ( this.check_is_tile_passable_for_monster( tilecoord + monster[6] ) == true ) {
                        // Up
                        e_tilecoord = tilecoord + monster[6];
                    }
                
                }

                let e_tile_x = e_tilecoord % 32;
                let e_tile_z = ( e_tilecoord / 32)  >> 0;
                let ex = ( e_tile_x - 15 ) * this.tile_size;
                let ey = 0.6; 
                let ez = (-e_tile_z + 15 ) * this.tile_size;
                
                monster[2] = 0;
                monster[3] = Vector3.create( sx, sy, sz );
                monster[4] = Vector3.create( ex, ey, ez );
                monster[7] = e_tilecoord;

            }
        }
    }


    //-----------------
    create_floor() {
        

        let tile_size = this.tile_size;
        for ( let i = 0 ; i < 20 ; i++ ) {
            for ( let j = 0 ; j < 20 ; j++ ) {
                
                let tile = engine.addEntity();
                Transform.create( tile , {
                    parent: this.root,
                    position: { 
                        x: (j-10) * tile_size,  y: 0 , z: (i-10) * tile_size
                    },
                    scale: {
                        x: 1,  y: 1, z: 1
                    }
                });
                MeshRenderer.setBox(tile);
                Material.setPbrMaterial(tile, {
                    albedoColor: Color4.fromInts(200,200,200,255),
                    metallic: 0.9,
                    roughness: 0.1,
                })
            }
        }
    }

    //------------

    update( dt ) {

        let _this = resources["stage"];


        if ( _this.game_state == 0 ) {



            // player
            if ( _this.player_stats[2] != null ) {
                _this.player_stats[2] += 0.4;

                let cur_tilecoord  = _this.player_pos.z * 32 + _this.player_pos.x;
                let new_tilecoord   = _this.player_stats[7];

                if (  _this.player_stats[2] >= 0.99 ) {
                    
                    _this.player_stats[2] = null;
                    _this.player_pos.x =   new_tilecoord % 32;
                    _this.player_pos.z = ( new_tilecoord / 32 ) >> 0;  
                    _this.player_align_avatar_to_player_pos_tilecoord();
            
                    _this.check_player_current_tile( cur_tilecoord );
                    
                }
            }




            // movable blocks
            for ( let tilecoord in _this.movables ) {
                
                if ( _this.movables[tilecoord][2] != null ) {
                    
                    _this.movables[tilecoord][2] += 0.1;
                    let tile = _this.movables[tilecoord][0];
                    let start = _this.movables[tilecoord][3];
                    let end = _this.movables[tilecoord][4];
                    let progress = _this.movables[tilecoord][2];    
                    Transform.getMutable( tile ).position = Vector3.lerp( start, end, progress );
                    

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
                                let tile = _this.create_colored_block(
                                    end.x,
                                    0.1,
                                    end.z,
                                    Color4.fromInts(100,80,40,255),
                                    1
                                );
                                _this.creatables[ tilecoord ] = [ tile , 38 ];

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

                // 97 bug, bluetank
                if ( type == 97 || type == 98 ) {
                    _this.monsters[tilecoord][2] += 0.05;
                    Transform.getMutable( tile ).position = Vector3.lerp( start, end, progress );
                    Transform.getMutable( tile ).rotation = Quaternion.fromEulerDegrees( 90 , _this.get_y_rot_by_direction(direction) , 0 );
                    
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
                        
                        delete _this.monsters[tilecoord];
                        _this.monsters[new_tilecoord] = [ tile, type , 0, null, null, null, direction ];
                        _this.monsters_next_move( new_tilecoord );
                        
                    }



                } else {
                    

                    if ( _this.player_pos.z * 32 + _this.player_pos.x == tilecoord ) {

                        //38 fire
                        if ( type == 38 ) {
                            let inventory_id = 5; 
                            // has fire boot
                            if ( resources["ui"]["inventory"]["items"][inventory_id].count > 0 ) {
                                // survive
                            } else {
                                resources["index"].play_sound("fire");
                                _this.gameover();
                            }
                        } else {
                            _this.gameover();
                        }
                    }
                }
                
            }
        }
    }
}

