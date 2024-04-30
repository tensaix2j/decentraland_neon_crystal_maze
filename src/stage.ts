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

import resources from "./resources";


//-------------------
export class Stage {

    public root;
    public tile_size = 1.05;
    public player;
    public entities = [];
    public current_level_obj:any = null;
    public player_pos = Vector3.create(0,0,0);

    public pickables = {};
    public removables = {};
    public patched = {};
    public movables = {};
    public creatables = {};


    
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
        this.load_level( level02.layers );
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
                    
                    // do not modify the this.current_level_obj directly
                    // use patch obj instead.
                    this.patched[ tilecoord ] = 1;
                    
                    
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
                    this.patched[ tilecoord ] = 1;
                }   
            }
        }
    }




    //----------------
    pickup_items() {

        if ( this.pickables[ this.player_pos.x + "," + this.player_pos.z  ] != null ) {
            // Pick up item if land on one.
            let ent     = this.pickables[ this.player_pos.x + "," + this.player_pos.z  ][0];
            let item_id = this.pickables[ this.player_pos.x + "," + this.player_pos.z  ][1];
            
            engine.removeEntity( ent );
            delete this.pickables[ this.player_pos.x + "," + this.player_pos.z  ] ;
            resources["index"].play_sound( "correct" );
            
            if ( item_id >= 66 && item_id <= 69 ) {
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


    //---
    check_for_stepping_on_death_traps(  ) {
        
        let tilecoord =  this.player_pos.z * 32 + this.player_pos.x ;
        if ( this.removables[ tilecoord ] && this.removables[ tilecoord ][1] == 37 && this.removables[tilecoord][5] == null ) {
            
            // Water trap

            this.gameover();
            Transform.getMutable(this.player).position.y = Transform.getMutable( this.root ).position.y + 0.8  - 1.0;
        }
    }

    //-------
    check_is_movable( tilecoord , direction ) {

        let ret = false;
        
        // Standard wall / locker
        if ( this.current_level_obj[  this.current_level_obj_index["fg"] ].data[  tilecoord  ] == 0  || 
             this.patched[ tilecoord ] == 1 ) {
            ret = true;
        }

        // Movable blocks, if there's a movable block, check if pushable or not.
        if ( this.movables[ tilecoord ] ) {

            if ( direction != 0 ) {
                if ( this.check_is_movable( tilecoord + direction , 0 ) == true ) {
                    // Can push into
                    ret = true;
                } else {
                    // Cannot push into
                    ret = false;
                }
            } else {
                // Recursive call ender
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

    //--------
    move_player(  direction ) {

        if ( this.game_state != 0 ) {
            return;
        }

        let tilecoord = ( this.player_pos.z * 32 + this.player_pos.x ) + direction;
        if ( this.check_is_movable( tilecoord , direction ) == true ) {
                
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
            this.open_lock_if_bump_into_one( tilecoord );
        }

        console.log( "Player current tile", this.player_pos.x, this.player_pos.z );
        this.pickup_items();
        this.check_for_stepping_on_death_traps();
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
    create_colored_block( x, y, z , color , height) {

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

       

        Material.setPbrMaterial( tile , {
            texture: Material.Texture.Common({
                src: "images/tileset.png",
            }),
            emissiveTexture: Material.Texture.Common({
                src: "images/tileset.png",
            }),
            emissiveColor:Color3.White(),
            emissiveIntensity: 1,
            metallic: 0,
            roughness: 1,
            
        })
        return tile;

    }




    //------
    create_pickable_item_plane( x, y, z , frame_x, frame_y , x_tile, z_tile , item_id ) {

        let tile = engine.addEntity();
        Transform.create( tile , {
            parent: this.root,
            position: { 
                x: x,  
                y: y, 
                z: z
            },
            scale: {
                x: 0.8,  y: 0.8, z: 0.8
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
        
        this.pickables[ x_tile + "," + z_tile ] = [ tile, item_id ];

        Material.setPbrMaterial( tile , {
            texture: Material.Texture.Common({
                src: "images/tileset.png",
            }),
            alphaTexture:Material.Texture.Common({
                src: "images/tileset.png",
            }),
            metallic: 0,
            roughness: 1,
            
        })

    }


    //-----------
    // this loads objects that can be reset.
    load_dynamic_objects( layers ) {

        
        for ( let ly = 0 ; ly < layers.length ; ly++ ) {
            for ( let i = 0 ; i < layers[ly].data.length ; i++ ) {

                let x_tile = i % 32;
                let z_tile =  (i / 32) >> 0 ;

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
                                1
                            );

                            this.patched[ i ] = 1;
                            this.movables[ i ] = [ tile , 7 ];

                        }
                    } 
                } else if ( layers[ly].name == "item" ) {

                    if ( layers[ly].data[i] == 35 ) {
                            
                        this.player_pos.x = x_tile ;
                        this.player_pos.z = z_tile ;
                        Transform.getMutable( this.player ).position.x = ( this.player_pos.x - 15 ) * this.tile_size + Transform.getMutable( this.root ).position.x ;
                        Transform.getMutable( this.player ).position.z = ( -this.player_pos.z + 15 ) * this.tile_size + Transform.getMutable( this.root ).position.z ;
                        Transform.getMutable( this.player ).position.y = Transform.getMutable( this.root ).position.y + 0.8 ;

                    } else if ( layers[ly].data[i] >= 65 && layers[ly].data[i] <= 69 ) {

                        // keys and item
                        if ( this.pickables[ x_tile + "," + z_tile ] == null ) {

                            this.create_pickable_item_plane( 
                                (x_tile - 15 ) * this.tile_size,
                                1, 
                                (-z_tile + 15 ) * this.tile_size, 
                                layers[ly].data[i] - 65,
                                29,
                                x_tile,
                                z_tile,
                                layers[ly].data[i]
                            );
                        

                            // Chip
                            if ( layers[ly].data[i] == 65 ) {
                                resources["ui"]["gamestatus"].chip_remaining += 1;
                            }
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


        for ( let tilecoord in this.patched ) {
            delete this.patched[tilecoord];
        }

        for ( let tilecoord in this.creatables ) {
            engine.removeEntity( this.creatables[tilecoord][0] );
            delete this.creatables[tilecoord];
        }

        for ( let tilecoord in this.movables ) {
           if ( this.current_level_obj[ this.current_level_obj_index["fg"] ].data[ tilecoord ] == 7 ) {
                this.movables[tilecoord][5] = null;
                

           } else {
                let tile = this.movables[tilecoord][0];
                engine.removeEntity( tile );
                delete this.movables[tilecoord];
           }
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

                        this.create_colored_block( 
                            (x_tile - 15 ) * this.tile_size,
                            0, 
                            (-z_tile + 15 ) * this.tile_size, 
                            Color4.fromInts(200,200,200,255) ,
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

                    
                    }

                
                } else if ( layers[ly].name == "fg" ) {

                    if ( layers[ly].data[i] == 1 ) {

                        // wall
                        this.create_colored_block( 
                            (x_tile - 15 ) * this.tile_size,
                            1, 
                            (-z_tile + 15 ) * this.tile_size, 
                            Color4.fromInts(120,120,120,255),
                            1
                        );

                    
                    }
                }
            }
            
        }
        this.load_dynamic_objects( layers );

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
        for ( let tilecoord in _this.movables ) {
            
            if ( _this.movables[tilecoord][2] != null ) {
                
                _this.movables[tilecoord][2] += 0.1;
                let tile = _this.movables[tilecoord][0];
                let start = _this.movables[tilecoord][3];
                let end = _this.movables[tilecoord][4];
                let amt = _this.movables[tilecoord][2];    
                Transform.getMutable( tile ).position = Vector3.lerp( start, end, amt );
                

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
    }
}

