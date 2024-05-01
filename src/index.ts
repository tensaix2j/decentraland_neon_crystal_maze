

import { 
    Vector3,
    Quaternion,
    Color3,
    Color4 } from "@dcl/sdk/math";


import {
    engine,
    Transform,
    GltfContainer,
    AvatarShape,
    inputSystem,
    PointerEvents,
    InputAction,
    PointerEventType,
    Material,
    MeshRenderer,
    MeshCollider,
    AvatarModifierArea,
    AvatarModifierType,
    CameraModeArea,
    CameraType,
    AudioSource
} from '@dcl/sdk/ecs'

import { getUserData } from '~system/UserIdentity'
import { movePlayerTo } from '~system/RestrictedActions'



import resources from "./resources";
import { Stage } from "./stage";
import { UI2D  } from "./ui2d";

//-------------------
class Index {

    public scene_parcels = Vector3.create(4,4,4);
    public camerabox;

    //--------------
    constructor() {

        resources["index"]  = this;
        resources["ui2d"]    = new UI2D();
        resources["stage"]  = new Stage( {x: 32 , y: 1 ,z:32} );
        
        
        /*
        let citytile_entity = engine.addEntity()
        Transform.create( citytile_entity, { 
            position: { 
                x: this.scene_parcels.x * 8, 
                y: 0.0, 
                z: this.scene_parcels.z * 8 
            },
            scale: {
                x: this.scene_parcels.x ,
                y: 1.0,
                z: this.scene_parcels.z  
            }
        })
        
        GltfContainer.create(citytile_entity, {
            src: 'models/CityTile.glb',
        })
        */

        this.init_async();
        this.createCameraBox();
        this.createModifierArea();
        this.init_sounds();
        
        engine.addSystem( this.update );
        
    }





    //----
    async init_async() {
        await this.init_userData();
    }



    //--------------
    async init_userData() {

        console.log("init_userData");
        if ( resources["userData"] == null ) {
        
            const userData = await getUserData({})
            console.log( "Check", userData.data ); 
            resources["userData"] = userData.data;
        }

    }


    //----------
    DistanceSquared( v1, v2 ) {

        let x_diff = v1.x - v2.x ;
        let y_diff = v1.y - v2.y ;
        let z_diff = v1.z - v2.z ;
        return x_diff * x_diff + y_diff * y_diff + z_diff * z_diff;

    }


    //-----------
    lookAt(entity, target) {

        let transform = Transform.getMutable( entity );
        const difference = Vector3.subtract(target, transform.position)
        const normalizedDifference = Vector3.normalize(difference)
        transform.rotation.y = Quaternion.lookRotation( normalizedDifference ).y
        transform.rotation.w = Quaternion.lookRotation( normalizedDifference ).w
    }


    //---------------
    init_sounds( ) {
    	
        resources["sounds"] = {};

    	let soundfiles = [
            "correct",
            "denied",
            "success",
            "teleport",
            "switch",
            "water",
            "fire"
        ];

        for ( let i = 0 ; i < soundfiles.length ; i++ ) {
            
            let snd_ent = engine.addEntity()
            AudioSource.create(snd_ent, {
                audioClipUrl: 'sounds/' + soundfiles[i] + '.mp3',
                playing: false,
                loop: false,
                volume: 1
            })
            Transform.create( snd_ent, {
                position:Vector3.create(0,0,0) 
            });
            resources["sounds"][ soundfiles[i] ] = snd_ent;
        }

    }

    //---------
    play_sound( soundname ) {
        
        Transform.getMutable( resources["sounds"][soundname] ).position =  Transform.get(engine.PlayerEntity).position;
        AudioSource.getMutable( resources["sounds"][soundname] ).playing = true;

    }


    //---
    createModifierArea() {

        const ent = engine.addEntity()
        /*
        AvatarModifierArea.create(ent, {
            area: Vector3.create( this.scene_parcels.x * 16,  this.scene_parcels.y * 16,  this.scene_parcels.z * 16),
            modifiers: [AvatarModifierType.AMT_DISABLE_PASSPORTS, AvatarModifierType.AMT_HIDE_AVATARS],
            excludeIds: []
        })
        */

        CameraModeArea.create(ent, {
            area: Vector3.create( this.scene_parcels.x * 16,  this.scene_parcels.y * 16,  this.scene_parcels.z * 16),
            mode: CameraType.CT_FIRST_PERSON,
        })

        Transform.create(ent, {
            position: Vector3.create(32, 0, 32),
        })

    }

    //-------
    createCameraBoxPart( ent_parent , position, scale ) {

        let ent = engine.addEntity() ;
        Transform.create( ent, {
            parent: ent_parent,
            position: position,
            scale: scale            
        });
        MeshCollider.setBox(ent);
        
        
        MeshRenderer.setBox(ent);
        Material.setPbrMaterial(ent, {
            albedoColor: Color4.fromInts(255,255,255,0),
            metallic: 0,
            roughness: 0,
        })
        
        
        return ent;
    }

    //-----------
    createCameraBox() {
        
        let camera_root = engine.addEntity();
        Transform.create( camera_root, {
            position: {
                x: 32,
                y: 8,
                z: 29 
            },
        });

        this.camerabox = camera_root;

        this.createCameraBoxPart( camera_root ,  { x: 0 , y: 0 , z: 0 },{ x: 4, y: 0.1, z: 4 });
        
        this.createCameraBoxPart( camera_root ,  { x: -0.5 , y: 1 , z: 0 },{ x: 0.2, y: 2, z: 2 });
        this.createCameraBoxPart( camera_root ,  { x:  0.5 , y: 1 , z: 0 },{ x: 0.2, y: 2, z: 2 });
        this.createCameraBoxPart( camera_root ,  { x:  0 , y: 1 , z: 0.5 },{ x: 2, y: 2, z: 0.2 });
        this.createCameraBoxPart( camera_root ,  { x:  0 , y: 1 , z: -0.5 },{ x: 2, y: 2, z: 0.2 });
        this.createCameraBoxPart( camera_root ,  { x:  0 , y: 1.35 , z: 0 },{ x: 2, y: 0.1, z: 2 });
        
    }

    //-----
    fix_player_position() {

        let camera_root_transform = Transform.getMutable( resources["index"].camerabox );
        if ( resources["index"].DistanceSquared( Transform.get(engine.PlayerEntity).position , camera_root_transform.position ) > 2 ) {
            console.log("fix_player_position");
            this.resetCameraPosition();
        } 
    }
    //------
    fix_camerabox_position() {
        
        let camera_box_transform = Transform.getMutable( resources["index"].camerabox );
        let player_transform = Transform.getMutable( resources["stage"].player );

        let target_position = Vector3.create(   
            player_transform.position.x ,
            camera_box_transform.position.y ,
            player_transform.position.z - 3,
        );

        if ( resources["index"].DistanceSquared( 
            camera_box_transform.position , 
            target_position ) > 2
        ) {
            
            camera_box_transform.position = Vector3.lerp( 
                camera_box_transform.position,
                target_position,
                0.025
            );
            
     
        }

    }
    //------
    resetCameraPosition() {
        let camera_root_transform = Transform.getMutable( resources["index"].camerabox );
        movePlayerTo(
            {
                newRelativePosition: Vector3.create(
                    camera_root_transform.position.x ,
                    camera_root_transform.position.y + 1,
                    camera_root_transform.position.z ,
                ),
                cameraTarget: Vector3.create(
                    camera_root_transform.position.x ,
                    camera_root_transform.position.y - 1,
                    camera_root_transform.position.z + 0.1,
                )
            }
        );
    }


    //----------
    update( dt ) {

        if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)){
                   
        }
        if (inputSystem.isTriggered(InputAction.IA_ACTION_3, PointerEventType.PET_DOWN)){
            resources["stage"].restart_level();     
        }
        if (inputSystem.isTriggered(InputAction.IA_ACTION_4, PointerEventType.PET_DOWN)){
            resources["stage"].gameover();     
        }

        if (inputSystem.isTriggered(InputAction.IA_LEFT, PointerEventType.PET_DOWN)){
            resources["stage"].move_player(-1);

        }
        if (inputSystem.isTriggered(InputAction.IA_FORWARD, PointerEventType.PET_DOWN)){
            resources["stage"].move_player(-32);
                   
        }
        if (inputSystem.isTriggered(InputAction.IA_RIGHT, PointerEventType.PET_DOWN)){
            resources["stage"].move_player(1);
                   
        }
        if (inputSystem.isTriggered(InputAction.IA_BACKWARD, PointerEventType.PET_DOWN)){
            resources["stage"].move_player(32);
                   
        }
        resources["index"].fix_player_position();
        resources["index"].fix_camerabox_position();
       
    }
    
}



new Index();

